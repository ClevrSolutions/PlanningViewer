(function(factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define(["PlanningViewer/lib/jquery", "PlanningViewer/lib/moment"], factory);
    } else if (typeof exports === "object") {
        // Node/CommonJS
        module.exports = factory(require("jquery"), require("moment"));
    } else {
        // Browser globals
        window.planning = factory(jQuery, moment);
    }
}(function($, moment) {

    "use strict";

    function getSortFunction(field, order) {
        if (order === "asc" || order !== "desc") {
            return function(a, b) {
                var dateA = a[field];
                var dateB = b[field];
                return dateA > dateB ? 1 : -1;
            };
        } else if (order === "desc") {
            return function(a, b) {
                var dateA = a[field];
                var dateB = b[field];
                return dateA < dateB ? 1 : -1;
            };
        }
    }

    function hexToRGB(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function(m, r, g, b) {
            return r + r + g + g + b + b;
        });

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    function getRGBFromObj(obj) {
        return "rgb(" + obj.r + "," + obj.g + "," + obj.b + ")";
    }

    function closure(target, options, originalOptions, events, events_SIM, ardates) {
        var scope_Target = target;
        var scope_Options = {};
        var scope_Values = [];
        var scope_Events = [];
        var scope_Events_SIM = [];
        var scope_EventType = "OPS";
        var scope_ARDates = [];
        var scope_Nodes = {};
        var scope_Mode = "FULL";
        var scope_Day = null;
        var scope_LegendNode = null;
        var scope_LegendItems = [];
        var scope_Self;

        function start() {
            scope_ARDates = ardates;

            renderPlanning();

            window.addEventListener("resize", onResize);
            var animating = false;
            $(".planning").on("scroll", function() {
                if (!animating) {
                    animating = true;
                    var css = {
                        "top": $(this).scrollTop()
                    };
                    $(".header-container").css(css);
                    animating = false;
                }
            });
        }

        function onResize() {
            var headerHeight = $(scope_Nodes.header)[0].offsetHeight;
            var bodyHeight = scope_Target.offsetHeight;
            var timelineHeight = (bodyHeight - headerHeight);

            scope_Nodes.timeline.css({
                "height": timelineHeight + "px"
            });
            scope_Nodes.header.css({
                "width": $(scope_Nodes.header)[0].scrollWidth
            });
        }

        function setScope(iEvents) {
            var startDate,
                startWeek,
                startDayNr,
                endDate,
                endWeek,
                endDayNr,
                range,
                scopeDurationMinutes,
                scopeDays;

            iEvents.sort(getSortFunction("plannedEnd", "desc"));
            endDate = moment(iEvents[0].plannedEnd);
            endDate.add(10, "days").endOf("day");
            scope_Options.endDate = endDate;
            scope_Options.endWeek = endDate.week();
            scope_Options.endDayNr = endDate.day();

            iEvents.sort(getSortFunction("plannedStart", "asc"));
            startDate = moment().startOf("day");
            scope_Options.startDate = startDate;
            scope_Options.startWeek = startDate.week();
            scope_Options.startDayNr = startDate.day();

            range = moment.range(startDate, endDate);
            scope_Options.scopeDurationMinutes = range.diff("minutes");
            scope_Options.scopeRange = range;

            scope_Events = iEvents;
        }

        function renderPlanning() {
            setScope(events);
            scope_Mode = "FULL";
            scope_EventType = "OPS";
            var $timeNode = $(scope_Target).find("time");
            $timeNode.empty();

            appendColumnHeaders($timeNode, scope_Events);
            appendEventRows($timeNode, scope_Events);
            renderLegend();
            var $btnTypeNode = $(scope_Target).find(".btn-type");
            $btnTypeNode.text("SIM");
            $btnTypeNode.off("click").on("click", renderSIMPlanning);
            onResize();
        }

        function renderSIMPlanning() {
            scope_Mode = "FULL";
            scope_EventType = "SIM";
            var $timeNode = $(scope_Target).find("time");
            var $btnTypeNode = $(scope_Target).find(".btn-type");
            $btnTypeNode.text("OPS");
            $btnTypeNode.off("click").on("click", renderPlanning);
            $timeNode.empty();

            setScope(events_SIM);

            //appendColumnHeaders($timeNode);
            appendColumnHeaders($timeNode, scope_Events);
            appendEventRows($timeNode, scope_Events);

            onResize();
        }

        function renderDayPlanning(mDay) {
            scope_Mode = "DAY";
            scope_Day = mDay;
            var day = moment(mDay);
            scope_Options.scopeDurationMinutes = moment.range(day.startOf("day"), day.endOf("day")).diff("minutes");
            var $timeNode = $(scope_Target).find("time");
            $timeNode.empty();

            $timeNode.append(createHourlyHeader(mDay));
            var events = getEventsForDay(mDay);

            appendEventRows($timeNode, events);
            onResize();
        }

        function renderToday() {
            renderDayPlanning(moment());
        }

        function renderLegend() {
            if (!scope_LegendNode) {

                scope_LegendItems.push({
                    state: "Ingepland nachtwerk",
                    color: "#06309e"
                }, {
                    state: "Langdurige werkzaamheden <br/> zonder operationele hinder",
                    color: "#007f7c"
                }, {
                    state: "AIRAC datum",
                    color: "#4c4c6b"
                }, {
                    state: "Volgens NOTAM uit dienst",
                    color: "#ffff00",
                    line: true
                });

                var $legendNode = $("<div>", {
                    "class": "planning-legend"
                });
                var $ulButtonNode = $("<div>", {
                    "class": "legend-buttons"
                });
                var $buttonTodayNode = $("<button>", {
                    "class": "btn btn-default"
                }).html("Today");
                var $buttonSIMNode = $("<button>", {
                    "class": "btn btn-default btn-type"
                }).html("SIM");
                $buttonTodayNode.on("click", renderToday);
                $buttonSIMNode.on("click", renderSIMPlanning);
                $ulButtonNode.append($buttonTodayNode);
                $ulButtonNode.append($buttonSIMNode);
                $legendNode.append($ulButtonNode);
                var $ulLegendNode = $("<ul>");
                $legendNode.append($ulLegendNode);
                for (var i = 0; i < scope_LegendItems.length; i++) {
                    var item = scope_LegendItems[i];
                    var $liLegendNode = $("<li>");
                    $ulLegendNode.append($liLegendNode);
                    var $divLegend = $("<div>", {
                        "class": "legend-item"
                    });
                    $liLegendNode.append($divLegend);
                    var $spanColorNode = $("<span>", {
                        class: "legend-icon"
                    });
                    $divLegend.append($spanColorNode);

                    var background = "#808080";
                    if (item.color && !item.line) {
                        background = item.color;
                    }

                    var colorStop1 = hexToRGB(background);
                    var colorStop2 = {
                        r: Math.round(colorStop1.r * 0.5),
                        g: Math.round(colorStop1.g * 0.5),
                        b: Math.round(colorStop1.b * 0.5)
                    };

                    background = "linear-gradient(" + getRGBFromObj(colorStop1) + "," + getRGBFromObj(colorStop2) + ")";

                    var css = {
                        "background" : background
                    }

                    if (item.line) {
                        css["border-bottom"] = "2px solid #ffff00";
                    }

                    $spanColorNode.css(css);
                    var $spanLabelNode = $("<span>", {
                        "class": "legend-label"
                    }).html(item.state);
                    $divLegend.append($spanLabelNode);
                }
                scope_LegendNode = $legendNode;
                $(scope_Target).append($legendNode);
            }
        }

        function createHourlyHeader(mDay) {
            var mStart = mDay.startOf("day");
            var mEnd = moment(mStart).endOf("day");
            var mRange = moment.range(mStart, mEnd);
            var nrHours = mRange.diff("hours");
            var mHours = mRange.toArray("hours");
            scope_Options.scopeDurationMinutes = mRange.diff("minutes");

            var $headerContainerNode = $("<div>", {
                "class": "header-container header-hours"
            });
            scope_Nodes.header = $headerContainerNode;

            var $headerNode = $("<header>");
            $headerContainerNode.append($headerNode);

            var $ulDateNode = $("<ul>");
            var $liDateNode = $("<li>", {
                "class": "today"
            });

            var $spanBackNode = $("<span>", {
                "class": "glyphicon glyphicon-chevron-left back"
            });
            $spanBackNode.click(function() {
                scope_Options.scopeDurationMinutes = scope_Options.scopeRange.diff("minutes");
                if (scope_EventType === "OPS") {
                    renderPlanning();
                } else {
                    renderSIMPlanning();
                }

            });
            $liDateNode.append($spanBackNode);

            var $spanDateNode = $("<div>");
            $spanDateNode.append(mDay.format("dddd DD-MM-YYYY"));
            $liDateNode.append($spanDateNode);

            $ulDateNode.append($liDateNode);
            $headerNode.append($ulDateNode);

            var $ulHoursNode = $("<ul>");
            $headerNode.append($ulHoursNode);

            mHours.forEach(function(mHour) {
                var $liHourNode = $("<li>", {
                    "class": "hour"
                });
                $liHourNode.attr({
                    "hour": mHour.format("LT")
                });

                $($ulHoursNode).append($liHourNode);
                var $spanHourNode = $("<span>", {
                    "class": "day-label"
                });
                $spanHourNode.html(mHour.format("LT"));
                $liHourNode.append($spanHourNode);
            });

            return $headerContainerNode;
        }

        function getEventsForDay(mDay) {
            var events = [];
            scope_Events.filter(function(event) {
                if (moment(event.plannedStart).startOf("day") <= mDay && moment(event.plannedEnd).endOf("day") >= mDay) {
                    events.push(event);
                }
            });
            return events;
        }

        function renderSelectedDay(dayNode) {
            if ($(dayNode).is("span")) {
                var mDay = moment($(dayNode).parent().attr("date"));
            } else {
                var mDay = moment($(dayNode).attr("date"));
            }


          renderDayPlanning(mDay);
        }

        function appendColumnHeaders($node, events) {
            var days = scope_Options.scopeRange.toArray("days");

            var $headerContainerNode = $("<div>", {
                "class": "header-container header-full"
            });
            scope_Nodes.header = $headerContainerNode;
            var $headerNode = $("<header>");
            $headerContainerNode.append($headerNode);
            var $ulWeeksNode = $("<ul>", {
                "class": "week-header"
            });
            $headerNode.append($ulWeeksNode);
            var $ulDaysNode = $("<ul>", {
                "class": "day-header"
            });
            $headerNode.append($ulDaysNode);

            var $backgroundContainerNode = $("<div>", {
                "class": "background-container"
            });
            var $ulDayBackground = $("<ul>", {
                "class": "day-background"
            });
            $backgroundContainerNode.append($ulDayBackground);

            var startDate = scope_Options.startDate;
            var startWeek = startDate.week();
            var startWeekYear = startDate.year();
            var startWeekDays = 8 - startDate.isoWeekday();

            var endDate = scope_Options.endDate;
            var endWeek = endDate.week();
            var endWeekYear = endDate.year();
            var endDateDay = endDate.isoWeekday();
            var endWeekDays = (endDateDay > 0) ? endDateDay : 7;

            var multiYear = (startWeekYear !== endWeekYear);

            var nrDays = days.length;

            var currentWeek = -1;
            var currentYear = -1;
            var isInitialWeek = true;
            var isEndWeek = false;
            var cssClass = "day";

            for (var i = 0; i < nrDays; i++) {
                var currentDay = days[i];
                var dayday = currentDay.day();
                currentYear = currentDay.year();

                if (currentWeek !== currentDay.week()) {
                    currentWeek = currentDay.week();
                    isEndWeek = (currentWeek === endWeek && currentYear === endWeekYear);
                    if (isInitialWeek) {
                        isInitialWeek = false;
                        $ulWeeksNode.append(createWeekNode(currentDay, startWeekDays));
                    } else if (isEndWeek) {
                        isEndWeek = false;
                        $ulWeeksNode.append(createWeekNode(currentDay, endWeekDays));
                    } else {
                        $ulWeeksNode.append(createWeekNode(currentDay, 7));
                    }
                }

                var arDatesLength = scope_ARDates.length;
                for (var h = 0; h < arDatesLength; h++) {
                    if (scope_ARDates[h].isSame(currentDay, "day")) {
                        cssClass = "day alt";
                        break;
                    } else {
                        cssClass = "day";
                    }
                }

                var $liDayNode = $("<li>", {
                    "class": cssClass
                });
                $liDayNode.attr({
                    "date": currentDay.format("YYYY-MM-DD")
                });

                $liDayNode.click(function(e) {renderSelectedDay(e.target)});
                $ulDaysNode.append($liDayNode);
                var $spanDayNode = $("<span>", {
                    "class": "day-label"
                });
                $spanDayNode.html(currentDay.format("L"));
                $liDayNode.append($spanDayNode);

                /*background */
                var cssbg = "weekday";
                if (dayday == 0 || dayday == 6) {
                    cssbg = "weekend";
                }
                var $lidayBackground = $("<li>", {
                    "class": cssbg
                });

                $ulDayBackground.append($lidayBackground);
            }

            $node.append($headerContainerNode);
            $headerContainerNode.css({
                "width": $($ulWeeksNode)[0].scrollWidth + "px"
            });

            /* background */
            $node.append($backgroundContainerNode);
            $backgroundContainerNode.css({
                "width" : $($ulWeeksNode)[0].scrollWidth + "px",
                "height" : events.length*16 + "px"
            })

        }

        function createWeekNode(day, days) {
            var week = day.week();
            var year = day.year();

            var $liWeekNode = $("<li>");
            $liWeekNode.css("width", (days * 96) + "px");
            var $spanWeekNode = $("<span>", {
                "class": "week-label"
            });
            $spanWeekNode.html("Week " + week);
            $liWeekNode.append($spanWeekNode);
            return $liWeekNode;
        }

        function appendEventRows(target, events) {
            var cssClass = (scope_Mode === "FULL") ? "timeline" : "timeline hours";
            var $ulEventsNode = $("<ul>", {
                "class": cssClass
            });
            $ulEventsNode.css({
                "width": $(scope_Nodes.header)[0].scrollWidth + "px"
            });
            scope_Nodes.timeline = $ulEventsNode;

            var nrEvents = events.length;
            for (var i = 0; i < nrEvents; i++) {
                var $liNode = $("<li>");
                $ulEventsNode.append($liNode);
                appendEvent(events[i], $liNode);
            }
            target.append($ulEventsNode);
        }

        function appendEvent(event, targetNode) {
            var $eventNode, $containerNode, start, end, title, blockWidth, blockOffset, scopeStart, scopeEnd, css, attr;

            if (scope_LegendItems.map(function(e) {
                    return e.state;
                }).indexOf(event.state) === -1) {
                scope_LegendItems.push({
                    state: event.state,
                    color: event.color
                });
            }

            if (scope_Mode === "FULL") {
                start = event.plannedStart;
                end = event.plannedEnd;
                scopeStart = scope_Options.startDate;
            } else if (scope_Mode === "DAY") {
                scopeStart = moment(scope_Day).startOf("day");
                scopeEnd = moment(scope_Day).endOf("day");
                if (event.plannedStart < scopeStart) {
                    start = moment(scope_Day).startOf("day");
                } else if (event.plannedStart >= scopeStart) {
                    start = event.plannedStart;
                }
                if (event.plannedEnd > scopeEnd) {
                    end = moment(scope_Day).endOf("day");
                } else if (event.plannedEnd <= scopeEnd) {
                    end = event.plannedEnd;
                }
            } else {
                throw Error;
            }

            title = "Ticket: " + event.id + "\n" + event.description + "\nPlanned start: " +
                event.plannedStart.format("L LTS") + "\nPlanned end: " + event.plannedEnd.format("L LTS");

            if (event.state) {
                title += "\nStatus: " + event.state;
            }

            blockWidth = computeEventBlockWidth(start, end);
            blockOffset = computeEventBlockOffset(scopeStart, start);

            $containerNode = $("<div>");
            $eventNode = $("<a>", {
                "class": "time-entry"
            });
            $containerNode.append($eventNode);

            var background = "#fff";

            if (event.disturbant) {
                event.color = "#086667";
            }

            var status = event.state.trim().toLowerCase();

            /* Adds the icludes function to IE and other browsers that don't support Includes yet */
            if (!String.prototype.includes) {
                String.prototype.includes = function() {
                    'use strict';
                    return String.prototype.indexOf.apply(this, arguments) !== -1;
                };
            }

            if (event.nightly && (status.includes("ingepland") || status.includes("planned"))){
                background = "#06309d";
                /*title += "\nNIGHTLY";*/
                /*event.description += "NIGHTLY";*/
            } else {
                if (event.color) {
                    var colorStop1 = hexToRGB(event.color);
                    var colorStop2 = {
                        r: Math.round(colorStop1.r * 0.5),
                        g: Math.round(colorStop1.g * 0.5),
                        b: Math.round(colorStop1.b * 0.5)
                    };

                    background = "linear-gradient(" + getRGBFromObj(colorStop1) + "," + getRGBFromObj(colorStop2) + ")";
                }
            }

            /*
            if (!event.nightly) {
                if (event.color) {
                    var colorStop1 = hexToRGB(event.color);
                    var colorStop2 = {
                        r: Math.round(colorStop1.r * 0.5),
                        g: Math.round(colorStop1.g * 0.5),
                        b: Math.round(colorStop1.b * 0.5)
                    };

                    background = "linear-gradient(" + getRGBFromObj(colorStop1) + "," + getRGBFromObj(colorStop2) + ")";
                }
            } else {
                background = "#06309d";
                title += "\nNIGHTLY";
                event.description += "NIGHTLY";
            }*/
            css = {
                background: background,
                width: (blockWidth.pixels > 5) ? blockWidth.percentage + "%" : blockWidth.pixels + "px",
                left: blockOffset + "%"
            };
            if (event.notam) {
                css["border-bottom"] = "2px solid #ffff00";
            }

            attr = {
                title: title
            };
            $eventNode.css(css);
            $eventNode.attr(attr);
            $($containerNode)[0].obj = event.obj;
            $containerNode.on("click", onClickEvent);

            var $labelNode = $("<span>", {
                "class": "time-entry-label"
            });
            //var label = (scope_Mode === "FULL") ? event.description : event.id + " : " + event.description;
            var label = event.id + " : " + event.description;
            $labelNode.html(label);
            $labelNode.css({
                "left": blockWidth.percentage + blockOffset + "%"
            });
            $containerNode.append($labelNode);
            targetNode.append($containerNode);
        }

        function onClickEvent(e) {
            e.preventDefault();
            options.onClickEvent(e.currentTarget.obj);
        }

        function computeEventBlockWidth(start, end) {
            var width, percentage, p, pixels, result;
            var eventRange = moment.range(start, end);
            var durationHours = eventRange.diff("minutes");
            percentage = durationHours / scope_Options.scopeDurationMinutes * 100;

            p = (((scope_Options.scopeDurationMinutes / 60 / 24) * 96) * percentage) / 100;

            pixels = (p > 5) ? p : 5;

            return {
                percentage: percentage,
                pixels: pixels
            };
        }


        function computeDurationInHours(start, end) {
            return (end.getTime() - start.getTime()) / 1000 / 60;
        }

        function computeEventBlockOffset(scopeStart, start) {
            var range = moment.range(scopeStart, start);
            var startHours = range.diff("minutes");
            return startHours / scope_Options.scopeDurationMinutes * 100;
        }

        function updateOptions(optionsToUpdate, fireSetEvent) {
            // TODO implement options
        }

        function destroy() {

            if (options.cssClasses) {
                for (var key in options.cssClasses) {
                    if (!options.cssClasses.hasOwnProperty(key)) {
                        continue;
                    }
                    //removeClass(scope_Target, options.cssClasses[key]);
                }
            }

            while (scope_Target.firstChild) {
                scope_Target.removeChild(scope_Target.firstChild);
            }

            delete scope_Target.planning;
        }

        start();

        scope_Self = {
            destroy: destroy,
            updateOptions: updateOptions,
            options: originalOptions,
            target: scope_Target
        };

        return scope_Self;
    }

    // Run the standard initializer
    function initialize(target, originalOptions, events, events_sim, ardates) {

        if (!target.nodeName) {
            throw new Error("planning.create requires a single element.");
        }

        // Test the options and create the planning environment;
        var options = originalOptions;
        var planning = closure(target, options, originalOptions, events, events_sim, ardates);

        // Use the public value method to set the start values.
        //planning.set(options.start);

        target.planning = planning;
        return planning;
    }

    // Use an object instead of a function for future expansibility;
    return {
        create: initialize
    };

}));
