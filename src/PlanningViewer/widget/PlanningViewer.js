/*global logger*/
/*
    PlanningViewer
    ========================

    @file      : PlanningViewer.js
    @version   : 1.0.0
    @author    : Nick van Wieren
    @date      : 6/6/2016
    @copyright : Mansystems 2016
    @license   : Apache 2

    Documentation
    ========================
    Planning Viewer Widget
*/

define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",

    "mxui/dom",
    "dojo/dom",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/_base/event",

    "PlanningViewer/lib/jquery",
    "PlanningViewer/lib/moment",
    "PlanningViewer/lib/moment-range",
    "PlanningViewer/lib/moment-locale-nl",
    "PlanningViewer/lib/planning",
    "dojo/text!PlanningViewer/widget/template/PlanningViewer.html"
], function(declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, dojoArray, dojoLang, dojoEvent, _jQuery, moment, DateRange, moment_nl, Planning, widgetTemplate) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    return declare("PlanningViewer.widget.PlanningViewer", [_WidgetBase, _TemplatedMixin], {
        templateString: widgetTemplate,

        // DOM elements
        inputNodes: null,

        // Parameters configured in the Modeler.
        mfToExecute: "",
        messageString: "",
        backgroundColor: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _alertDiv: null,
        _readOnly: false,
        _attributes: [],
        _stateAttributes: [],
        _references: {},
        _stateAssoc: null,

        constructor: function() {
            logger.debug(this.id + ".constructor");
            this._handles = [];
            this.events = [];
            this.airacDates = [];
        },

        postCreate: function() {
            logger.debug(this.id + ".postCreate");

            if (this.readOnly || this.get("disabled") || this.readonly) {
                this._readOnly = true;
            }
            if (this.plIdAttribute) this._attributes.push(this.plIdAttribute);
            if (this.plTypeAttribute) this._attributes.push(this.plTypeAttribute);
            if (this.plDescrAttribute) this._attributes.push(this.plDescrAttribute);
            if (this.plStartAttribute) this._attributes.push(this.plStartAttribute);
            if (this.plEndAttribute) this._attributes.push(this.plEndAttribute);
            if (this.plColorAttribute) this._attributes.push(this.plColorAttribute);
            if (this.plNotamAttribute) this._attributes.push(this.plNotamAttribute);
            if (this.plDisturbantAttribute) this._attributes.push(this.plDisturbantAttribute);

            if (this.plStateEntity) {
                this._stateAssoc = this.plStateEntity.split("/");

                if (this.plStateAttribute) this._stateAttributes.push(this.plStateAttribute);
                if (this.plStateColorAttribute) this._stateAttributes.push(this.plStateColorAttribute);

                this._references[this._stateAssoc[0]] = {
                    attributes: this._stateAttributes
                };
            } else {
                this._references = [];
            }



            // this._updateRendering();
        },

        update: function(obj, callback) {
            logger.debug(this.id + ".update");

            if (this._handles && this._handles.length && this._handles.length > 0) {
                dojoArray.forEach(this._handles, function(handle) {
                    mx.data.unsubscribe(handle);
                });
            }
            this._handles = [];

            this._contextObj = obj;
            this.fGetPlanningData();
            this._resetSubscriptions();
            this._updateRendering(callback); // We're passing the callback to updateRendering to be called after DOM-manipulation
        },

        enable: function() {
            logger.debug(this.id + ".enable");
        },

        disable: function() {
            logger.debug(this.id + ".disable");
        },

        resize: function(box) {
            logger.debug(this.id + ".resize");
        },

        uninitialize: function() {
            logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },

        // We want to stop events on a mobile device
        _stopBubblingEventOnMobile: function(e) {
            logger.debug(this.id + "._stopBubblingEventOnMobile");
            if (typeof document.ontouchstart !== "undefined") {
                dojoEvent.stop(e);
            }
        },

        // Rerender the interface.
        _updateRendering: function(callback) {
            logger.debug(this.id + "._updateRendering");

            if (callback) {
                callback();
            };
        },

        fGetPlanningData: function() {
            logger.debug(this.id + ".fGetPlanningData");
            var constraint = null,
                expectObj = null,
                xpath = null,
                filter = {},
                errordiv = null;

            constraint = this.plObjectConstraint;
            expectObj = this.plObjectConstraint.indexOf("[%CurrentObject%]") >= 0;

            if (this._mxObj && expectObj) {
                constraint = this.plObjectConstraint.replace(/\[%CurrentObject%\]/gi, this._mxObj.getGuid());
            } else if (expectObj) {
                // TODO implement clear planning
                return;
            }

            xpath = "//" + this.plObjectEntity + constraint;

            filter = {
                sort: [
                    [this.plStartAttribute, "asc"]
                ],
                attributes: this._attributes,
                references: this._references
            };

            mx.data.get({
                xpath: xpath,
                filter: filter,
                callback: function(objs) {
                    this.fPrepareData(objs);
                },
                error: function(error) {
                    logger.error(this.id + ".fGetPlanningData: An error occurred while fetching object\n" + error);
                }
            }, this);
        },

        fGetAIRACData: function() {
            logger.debug(this.id + ".fGetAIRACData");
            var constraint = null,
                expectObj = null,
                xpath = null,
                filter = {},
                errordiv = null;

            constraint = this.arObjectConstraint;
            expectObj = this.arObjectConstraint.indexOf("[%CurrentObject%]") >= 0;

            if (this._mxObj && expectObj) {
                constraint = this.arObjectConstraint.replace(/\[%CurrentObject%\]/gi, this._mxObj.getGuid());
            } else if (expectObj) {
                // TODO implement clear planning
                return;
            }

            xpath = "//" + this.arObjectEntity + constraint;

            filter = {
                sort: [
                    [this.arDateAttribute, "asc"]
                ],
                attributes: [this.arDateAttribute]
            };

            mx.data.get({
                xpath: xpath,
                filter: filter,
                callback: function(objs) {
                    this.fPrepareAIRACData(objs);
                    this.fRenderPlanning();
                },
                error: function(error) {
                    logger.error(this.id + ".fGetPlanningData: An error occurred while fetching object\n" + error);
                }
            }, this);
        },

        fPrepareData: function(objs) {
            logger.debug(this.id + ".fPrepareData");
            var events = [];
            var events_sim = [];

            if (typeof objs === "undefined" || objs === "" || objs.length === 0) {
                return;
            }

            dojoArray.forEach(objs, function(event, i) {
                mx.data.get({
                    guid: event.getGuid(),
                    path: this._stateAssoc[0],
                    callback: dojoLang.hitch(this, function (mxObjects) {
                        if (mxObjects > 0) {
                            // var state = event.get(this._stateAssoc[0]);
                            var start = moment(event.get(this.plStartAttribute));
                            var end = moment(event.get(this.plEndAttribute));
                            var range = moment.range(start, end);
                            var duration = range.diff("minutes");
            
                            var start8 = moment(start);
                            start8.set({
                                hour: 19,
                                minute: 58
                            });
                            var start9 = moment(start);
                            start9.set({
                                hour: 20,
                                minute: 59
                            });
                            var start3 = moment(start);
                            start3.set({
                                hour: 3,
                                minute: 1
                            });
            
                            var nightly = ((start.isAfter(start8) && duration > 120 && duration < 601) ||
                                (start.isAfter(start9) && duration < 480) ||
                                (start.isBefore(start3) && duration < 300));
            
                            var type = event.get(this.plTypeAttribute);
            
                            var eventObj = {
                                obj: event,
                                id: event.get(this.plIdAttribute),
                                description: event.get(this.plDescrAttribute),
                                plannedStart: start,
                                plannedEnd: end,
                                nightly: nightly,
                                state: mxObjects[0].get(this.plStateAttribute),
                                color: mxObjects[0].get(this.plStateColorAttribute),
                                notam: event.get(this.plNotamAttribute),
                                disturbant: event.get(this.plDisturbantAttribute)
                            };
                            if (type === "SIM") {
                                events_sim.push(eventObj);
                            } else {
                                events.push(eventObj);
                            }
                            this.events = events;
                            this.events_sim = events_sim;
                            this.fGetAIRACData();
                        }

                    })
                });

            }, this);
        },

        fPrepareAIRACData: function(objs) {
            logger.debug(this.id + ".fPrepareAIRACData");
            var dates = [];

            if (typeof objs === "undefined" || objs === "" || objs.length === 0) {
                return;
            }

            dojoArray.forEach(objs, function(obj, i) {
                var date = obj.get(this.arDateAttribute);
                var mDate;
                if (date) {
                    mDate = moment(date);
                    dates.push(mDate);
                }
            }, this);
            this.airacDates = dates;
        },

        fRenderPlanning: function() {
            var options = {
                daysBefore: 2,
                daysAfter: 10,
                onClickEvent: dojoLang.hitch(this, this.fOnClickEvent)
            };
            Planning.create(this.domNode, options, this.events, this.events_sim, this.airacDates);
        },

        fOnClickEvent: function(event) {
            var guid = event.getGuid();
            mx.data.action({
                params: {
                    applyto: "selection",
                    actionname: this.clickMicroflow,
                    guids: [guid],
                },
                callback: function(obj) {},
                error: function(error) {
                    alert(error.description);
                }
            }, this);
        },

        _unsubscribe: function() {
            if (this._handles) {
                dojoArray.forEach(this._handles, function(handle) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = [];
            }
        },

        _resetSubscriptions: function() {
            logger.debug(this.id + "._resetSubscriptions");
            this._unsubscribe();

            if (this._contextObj) {
                var objectHandle = mx.data.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function(guid) {
                        this._updateRendering();
                    })
                });

                this._handles = [objectHandle];
            }
        }
    });
});

require(["PlanningViewer/widget/PlanningViewer"]);
