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
                throw new Error("There is no region \"" + regionName + "\".");
            }

            if (regionEl.hasAttribute(DATA_OUTLET_ATTRIBUTE)) {
                renderedElement = regionEl;
            } else {
                var renderable = regionMap[regionName];
                renderedElement = renderable.render();
                regionEl.parentNode.replaceChild(renderedElement, regionEl);

                var pluginEvent = { name: regionName, renderable: renderable, element: renderedElement };
                pluginHook("renderRegion", pluginEvent, options, regions);
            }

            regions[regionName] = renderedElement;
        });
    }

    // Code block to keep renderables in sync when refreshed.
    var regionRenderables = {};

    function createRegionOutletEl(regionName) {
        var outletEl = document.createElement("div");
        outletEl.setAttribute(DATA_OUTLET_ATTRIBUTE, DATA_OUTLET_ATTRIBUTE);
        outletEl.setAttribute(DATA_REGION_ATTRIBUTE, regionName);
        return outletEl;
    }

    function resetRegionRenderablesRefreshHandler(regionName) {
        if (regionRenderables[regionName]) {
            var regionInfo = regionRenderables[regionName];
            regionInfo.renderable.off("refresh", regionInfo.onRefresh);
        }
    }

    function keepRegionInSyncWithRenderable(regionName, renderable) {
        resetRegionRenderablesRefreshHandler(regionName);

        function updateRegionOnRefresh(newElement) {
            regions[regionName] = newElement;
        }

        // Hook into `beforeDestroy` so we can still have an element mapped to the region.
        // After destroy the region still needs an element in the DOM so we have something to swap
        // with on future `renderRegion` calls.
        function resetRegionOnDestroy() {
            var elementInRegion = renderable.element;
            var outletEl = createRegionOutletEl(regionName);

            // Guard against DOM updates where the element is no longer attached.
            if (elementInRegion.parentNode) {
                elementInRegion.parentNode.replaceChild(outletEl, elementInRegion);
                regions[regionName] = outletEl;
            }
        }

        regionRenderables[regionName] = {
            renderable: renderable,
            onRefresh: updateRegionOnRefresh
        };

        renderable.on("refresh", updateRegionOnRefresh);
        renderable.once("beforeDestroy", resetRegionOnDestroy);
    }
    // End Code block.

    that.renderRegion = function (regionName, renderable) {
        if (regionName in regions) {
            var regionEl = that.regions[regionName];
            var renderedElement = renderable.element || renderable.render();
            regionEl.parentNode.replaceChild(renderedElement, regionEl);

            var pluginEvent = { name: regionName, renderable: renderable, element: renderedElement };
            pluginHook("renderRegion", pluginEvent, options, regions);

            regions[regionName] = renderedElement;

            keepRegionInSyncWithRenderable(regionName, renderable);
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

        pluginHook("beforeRenderRenderables", element, options);

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

        return Q.all(promises).thenResolve(element);
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

    that.dispose = function () {
        pluginHook("dispose", element, options);
    };

    that.destroy = function() {
        if (!element) {
            console.warn("View elements must be in the DOM to be destroyed.");
            return;
        }

        pluginHook("beforeDestroy", element, options);

        if (element.parentNode) { // Removal might have been handled by plugin.
            element.parentNode.removeChild(element);
        }

        that.dispose();
    };

    // Register plugins with the view.
    that.use = function (plugin) {
        plugins.push(plugin);
    };
}

module.exports = NobleView;
module.exports.config = config;
