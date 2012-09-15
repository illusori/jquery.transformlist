/* Copyright 2012, Sam Graham.
 * Licensed under GPL version 3.
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see http://www.gnu.org/licenses/
 * For latest version, see https://github.com/illusori/jquery.transformlist
 */
(function (window, $, undefined) {

"use strict";

// Lifted from jQuery core
var core_pnum = /[\-+]?(?:\d*\.|)\d+(?:[eE][\-+]?\d+|)/.source,
    rrelNum = new RegExp( "^([-+])=(" + core_pnum + ")([a-z]+)?", "i" ),
    transformlists = {};

$.extend({
    TransformList: function (name, arg) {
            if (typeof name === 'object') {
                if ((name.interpolateList !== undefined) && $.isFunction(name.interpolateList)) {
                    // Already one of our proxy objects. Just a convenience null-op.
                    return name;
                }
                if (!name.transformlist) {
                    // I need to not write error messages at 3am. Incoherent is, as incoherent does.
                    throw new Error("Must supply 'transformlist' property to name your TransformList in singule-argument mode.");
                }
                // Anon object with a transformlist property, construct our proxy.
                return $.TransformList(name.transformlist, name);
            }

            if (transformlists[name] === undefined) {
                transformlists[name] = {
                    transformOrder: [],
                    transforms: {}
                    };
            }

            var transformlist = transformlists[name],
                proxy = {
                    name: name,
                    listArguments: {},
                    containsRelativeArguments: false,

                    addTransform: function (transformName, transformFunction) {
                            transformlist.transformOrder.unshift(transformName);
                            transformlist.transforms[transformName] = {
                                transformFunction: transformFunction,
                                defaults: Array.prototype.splice.call(arguments, 2)
                                };
                            return this;
                        },

                    transform: function (transformName) {
                            if (arguments.length === 1) {
                                if (typeof transformName === "string") {
                                    // It's a query
                                    if (this.listArguments[transformName] !== undefined) {
                                        return this.listArguments[transformName];
                                    }
                                    // Fall through to defaults
                                    return transformlists[this.name].transforms[transformName].defaults;
                                }
                                // Else it's a multi-set.
                                $.each(transformName, $.proxy(function (transformName, transformArguments) {
                                    if (!$.isArray(transformArguments)) {
                                        transformArguments = [ transformArguments ];
                                    }
                                    this.transform.apply(this, [ transformName ].concat(transformArguments));
                                }, this));
                                return this;
                            }
                            // Else it's a single-set.
                            if (!transformlists[this.name].transforms[transformName]) {
                                // TODO: Unknown transform name, probably should warn.
                                return this;
                            }
                            this.listArguments[transformName] = Array.prototype.splice.call(arguments, 1);
                            var hasRel = false;
                            $.each(this.listArguments[transformName], $.proxy(function (idx, transformArgument) {
                                    if (rrelNum.exec(transformArgument)) {
                                        hasRel = true;
                                        return false;
                                    }
                                }, this));
                            this.containsRelativeArguments = hasRel;
                            return this;
                        },

                    // TODO: is it better to return a new object rather than resolve this?
                    resolveRelativeTo: function (relativeTo) {
                            if (!this.containsRelativeArguments) {
                                return this;
                            }
                            // Oh, I knew using an anonymous proxy would bite me in the ass.
                            if (relativeTo && !$.isPlainObject(relativeTo)) {
                                // Relative to the last transformlist the element was set to,
                                // or to the defaults for this transformlist type.
                                relativeTo = $(relativeTo).css('transformlist');
                            }
                            relativeTo = relativeTo || $.TransformList(this.name);

                            if (relativeTo.name !== this.name) {
                                throw new Error("Cannot resolve relative to a different transformlist type");
                            }

                            if (relativeTo.containsRelativeArguments) {
                                throw new Error("Cannot resolve relative to a transformlist that has relative arguments of its own");
                            }

                            $.each(this.listArguments, $.proxy(function (transformName, transformArguments) {
                                    $.each(transformArguments, $.proxy(function (idx, transformArgument) {
                                            var ret = rrelNum.exec(transformArgument);
                                            if (ret) {
                                                // Don't mix and match units, it'll break...
                                                this.listArguments[transformName][idx] = ((ret[1] + 1) * ret[2] + parseFloat(relativeTo.transform(transformName))) + (ret[3] || '');
                                            }
                                        }, this));
                                }, this));
                            this.containsRelativeArguments = false;
                            return this;
                        },

                    /**
                     * Interpolate a transformlist at <progress> distance between this
                     * transformlist and the target list. Returns a new transformlist object.
                     * Progress is a float from 0.0 to 1.0.
                     */
                    interpolateList: function (endList, progress) {
                            if (endList.name !== this.name) {
                                throw new Error("Cannot interpolate between two different transformlist types (from: " + this.name + " to: " + endList.name + ")");
                            }
                            // TODO: Hmm, this modification-by-reference could cause issues.
                            endList.resolveRelativeTo(this);
                            var interpolated = {};
                            // Ew, ugly code alert.
                            $.each(transformlists[this.name].transformOrder, $.proxy(function (idx, transformName) {
                                    var startArguments = this.transform(transformName),
                                        endArguments = endList.transform(transformName),
                                        defaultArguments = transformlists[this.name].transforms[transformName].defaults,
                                        interpolatedArguments = [],
                                        changed = false;
                                    for (var i = 0; i < startArguments.length; i++) {
                                        var val = startArguments[i],
                                            start = parseFloat(startArguments[i]),
                                            end = parseFloat(endArguments[i]);
                                        if (start !== end) {
                                            // TODO: prebuild regexp.
                                            var unit = /([a-z]+)$/.exec(startArguments[i]);
                                            val = (start + ((end - start) * progress)) + (unit ? unit[1] : '');
                                        }
                                        if (val !== defaultArguments[i]) {
                                            changed = true;
                                        }
                                        interpolatedArguments.push(val);
                                    }
                                    if (changed) {
                                        interpolated[transformName] = interpolatedArguments;
                                    }
                                }, this));
                            return $.TransformList(this.name, interpolated);
                        },

                        toString: function() {
                            var def = transformlists[this.name];
                            return $.map(def.transformOrder, $.proxy(function (transformName) {
                                    return def.transforms[transformName].transformFunction + '(' +
                                        this.transform(transformName).join(', ') + ')';
                                }, this)).join(' ');
                        }
                    };

            if (arg !== undefined) {
                proxy.transform(arg);
            }

            return proxy;
        }
    });

$.cssHooks.transformlist = {
    get: function (elem, computed, extra) {
        return $(elem).data('transformlist');
    },

    set: function (elem, value, extra) {
        value = $.TransformList(value);
        if (value.containsRelativeArguments) {
            value.resolveRelativeTo(elem);
        }
        $(elem).data('transformlist', value)
            .css('transform', value.toString());
    }
};

$.fx.step.transformlist = function (fx) {
    // TODO: is fx.state == 0 reliable instead?
    if (!fx.transformlistInit) {
        /* If it's the start of the animation, grab our starting
         * position from the raw transform value stored by the cssHook.
         * Also ensure our end point is a TransformList proxy.
         */
        fx.end   = $.TransformList(fx.end);
        fx.start = $(fx.elem).css('transformlist');
        fx.transformlistInit = true;
    }
    var interpolated = fx.start.interpolateList(fx.end, fx.pos);
    $(fx.elem).css('transformlist', interpolated);
};

})(window, jQuery);
