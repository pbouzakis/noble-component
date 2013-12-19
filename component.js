"use strict";

var View = require("./View");
var makeEmitter = require("pubit-as-promised").makeEmitter;

module.exports = function mixinComponent(target, template) {
    var view = new View(template);
    var events = ["beforeRender", "render", "beforeRefresh", "refresh"];
    var publish = makeEmitter(target, events);

    target.option = function (key, value) {
        if (value === undefined) {
            return view.options[key];
        }

        view.options[key] = value;
        return target;
    };

    target.events = function () {
        events.push.apply(events, [].slice.call(arguments));
        return target;
    };

    target.mixins = function (mixin) {
        // All components come w/ showable mixin (Only supported mixin via option)
        // Next step is that mixins can be an arra
        function setDisplay(display) {
            if (target.element) {
                target.element.style.display = display;
            }
        }

        if (mixin === "showable") {
            target.show = setDisplay.bind(target, "block"); // Assume we are show block elements.
            target.hide = setDisplay.bind(target, "none");
        }

        return target;
    };

    target.render = function () {
        publish("beforeRender", view.options);
        target.element = view.render();
        publish("render", target.element);
        return target.element;
    };

    target.refresh = function () {
        var args = [].slice.call(arguments);
        args.push(view.options);

        publish.apply(target, ["beforeRefresh"].concat(args));

        return view.refresh().then(function (element) {
            target.element = element;
            publish.apply(target, ["refresh", element].concat(args));
        });
    };

    target.region = function (region, renderable) {
        view.renderRegion(region, renderable);
        return target;
    };

    var on = target.on;
    target.on = function (event, handler) {
        on(event, handler.bind(target));
        return target;
    };

    target.destroy = view.destroy;
    target.process = view.process;
    target.publish = publish;

    return target;
};
