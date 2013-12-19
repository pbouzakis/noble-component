"use strict";

var Q = require("q");
var domify = require("domify");
var config = require("./config");

function NobleView(template, options) {
    var DATA_REGION_ATTRIBUTE = config.DATA_REGION_ATTRIBUTE;
    var DATA_OUTLET_ATTRIBUTE = config.DATA_OUTLET_ATTRIBUTE;

    var that = this;
    options = options || {};
    options.template = template;

    var element = null;
    var plugins = config.plugins.slice(); // Copy statically registered plugins.
    var regions = {};

    Object.defineProperties(that, {
        // `element` can be modified if `render()` is called again, so this is an accessor, not a data descriptor.
        element: { get: function () { return element; }, enumerable: true },
        regions: { get: function () { return regions; }, enumerable: true },
        options: { value: options, enumerable: true }
    });
    // that.options = options; // Getter/Setter property.

    function pluginHook(hook) {
        var args = [].slice.call(arguments, 1);
        plugins.forEach(function (plugin) {
            plugin[hook].apply(plugin, args);
        });
    }

    function renderRenderables() {
        var regionMap = options.renderables;

        [].forEach.call(element.querySelectorAll("div[" + DATA_REGION_ATTRIBUTE + "]"), function (regionEl) {
            var regionName = regionEl.getAttribute(DATA_REGION_ATTRIBUTE);
            var renderedElement;

            if (!regionMap[regionName] && !regionEl.hasAttribute(DATA_OUTLET_ATTRIBUTE)) {
                throw new Error('There is no region "' + regionName + '".');
            }

            if (regionEl.hasAttribute(DATA_OUTLET_ATTRIBUTE)) {
                renderedElement = regionEl;
            } else {
                var renderable = regionMap[regionName];
                renderedElement = renderable.render();
                regionEl.parentNode.replaceChild(renderedElement, regionEl);
            }

            regions[regionName] = renderedElement;
        });
    }

    that.renderRegion = function (regionName, renderable) {
        if (regionName in regions) {
            var regionEl = that.regions[regionName];
            var renderedElement = renderable.render();
            regionEl.parentNode.replaceChild(renderedElement, regionEl);
            regions[regionName] = renderedElement;
            return renderedElement;
        }

        throw new Error("Region does not exist: " + regionName);
    };

    that.render = function () {
        pluginHook("beforeRender", options);

        var template = options.template;
        var context = options.context;

        element = options.element || domify(template(context));
        delete options.element;

        pluginHook("beforeRenderRenderables", element, options)

        if (options.renderables) {
            renderRenderables();
        }

        pluginHook("render", element, options);

        return element;
    };

    that.process = function () {
        var promises = plugins.map(function (plugin) {
            return Q.when(plugin.process(element));
        });

        return Q.all(promises);
    };

    that.refresh = Q.fbind(function () {
        if (!element || !element.parentNode) {
            throw new Error("View elements must be in the DOM in order to be refreshed.");
        }

        pluginHook("beforeRefresh", element, options);

        var oldEl = element;
        that.render();
        oldEl.parentNode.replaceChild(element, oldEl);

        pluginHook("refresh", element, options);

        return that.process().thenResolve(element);
    });

    that.destroy = function() {
        if (!element || !element.parentNode) {
            throw new Error("View elements must be in the DOM to be destroyed.");
        }

        pluginHook("beforeDestroy", element, options);

        element.parentNode.removeChild(element);
    };

    // Register plugins with the view.
    that.use = function (plugin) {
        plugins.push(plugin);
    };
}

module.exports = NobleView;
module.exports.config = config;
