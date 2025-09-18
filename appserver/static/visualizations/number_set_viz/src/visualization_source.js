define([
    'jquery',
    'api/SplunkVisualizationBase',
    'api/SplunkVisualizationUtils',
    'chart.js',
    'tinycolor2'
],
function(
    $,
    SplunkVisualizationBase,
    vizUtils,
    Chart,
    tinycolor
) {
    var vizObj = {
        initialize: function() {
            SplunkVisualizationBase.prototype.initialize.apply(this, arguments);
            var viz = this;
            viz.instance_id = Math.round(Math.random() * 1000000);
            var theme = 'light'; 
            if (typeof vizUtils.getCurrentTheme === "function") {
                theme = vizUtils.getCurrentTheme();
            }
            viz.colors = ["#006d9c", "#4fa484", "#ec9960", "#af575a", "#b6c75a", "#62b3b2"];
            if (typeof vizUtils.getColorPalette === "function") {
                viz.colors = vizUtils.getColorPalette("splunkCategorical", theme);
            }
            viz.$container_wrap = $(viz.el);
            viz.$container_wrap.addClass("number_set_viz-container");
        },


        formatData: function(data) {
            console.log(JSON.stringify(data.meta));
            return data;
        },


        updateView: function(data, config) {
            var viz = this;
            viz.config = {
                heightmin: "50",
                heightmax: "300",
                ratio: "200",
                margin: "10",
                maxrows: "10000",
                nodatacolor: "#0178c7",
                thresholdcol1: "#1a9035",
                thresholdcol2: "#d16f18",
                thresholdcol3: "#b22b32",
                thresholdcol4: "#ffffff",
                thresholdcol5: "#ffffff",
                thresholdcol6: "#ffffff",
                thresholdval2: "70",
                thresholdval3: "90",
                thresholdval4: "",
                thresholdval5: "",
                thresholdval6: "",
                colormode: "auto",
                color: "#000000",

                sparkorder: "yes",
                sparkstyle: "area",
                sparknulls: "gaps",
                sparkcolormodeline: "darker2",
                sparkcolorline: "#0178c7",
                sparkcolormodefill: "darker1",
                sparkcolorfill: "#009DD9",
                sparkmin: "0",
                sparkmax: "",
                sparkalign: "0",
                sparkalignv: "70",
                sparkHeight: "30",
                sparkWidth: "100",

                textmode: "static",
                textcolor: "#ffffff",
                textalign: "center",
                textalignv: "50",
                textsize: "140",
                textprecision: "1",
                textprocessing: "",
                textunit: "",
                textunitsize: "50",
                textunitposition: "after",
                textfont: "",
                textdrop: "yes",
                textdropcolor: "#000000",

                titletext: "",
                titlealign: "center",
                titlealignv: "18",
                titlesize: "70",
                titlecolormode: "static",
                titlecolor: "#ffffff",
                titlefont: "",
                titledrop: "no",
                titledropcolor: "#000000",

                subtitletext: "",
                subtitlealign: "center",
                subtitlealignv: "80",
                subtitlesize: "50",
                subtitlecolormode: "static",
                subtitlecolor: "#ffffff",
                subtitlefont: "",
                subtitledrop: "no",
                subtitledropcolor: "#000000",

                absolute: "no",
                positions: "",
                background: "",
                width: "",
                coarse_positions: "no",
                labels_as_html: "no",
                shadows: "no",
                radius: "0",
                animation: "no",
            };

            // Override defaults with selected items from the UI
            for (var opt in config) {
                if (config.hasOwnProperty(opt)) {
                    viz.config[ opt.replace(viz.getPropertyNamespaceInfo().propertyNamespace,'') ] = config[opt];
                }
            }

            var numberFields = ["heightmin", "heightmax", "ratio", "margin", "maxrows", "thresholdval2", "thresholdval3", "thresholdval4", "thresholdval5", "thresholdval6", "sparkmin", "sparkmax", "sparkalign", "sparkalignv", "sparkHeight", "sparkWidth", "textalignv", "textsize", "titlealignv", "titlesize", "subtitlealignv", "subtitlesize", "width", "radius"];

            // Convert these fields from strings to numbers
            for (var i=0; i < numberFields.length; i++) {
                if (viz.config[numberFields[i]] !== "") {
                    viz.config[numberFields[i]] = Number(viz.config[numberFields[i]]);
                }
            }

            viz.data = data;
            viz.scheduleDraw();

            $(window).off("resize.number_set_viz").on("resize.number_set_viz", function () {
                viz.scheduleDraw();
            });
        },

        // debounce the draw
        scheduleDraw: function(){
            var viz = this;
            clearTimeout(viz.drawtimeout);
            viz.drawtimeout = setTimeout(function(){
                viz.doDraw();
            }, 300);
        },

        doDraw: function(){
            var viz = this;
            // Dont draw unless this is a real element under body
            if (! viz.$container_wrap.parents().is("body")) {
                return;
            }

            // reset and custom CSS on container item
            viz.$container_wrap.attr("style", "height:100%;");

            // Keep track of the container size the config used so we know if we need to redraw teh whole page
            viz.config.containerHeight = viz.$container_wrap.height();
            viz.config.containerWidth = viz.$container_wrap.width();
            // Manually defined width
            var widthDefined = Number(viz.config.width);
            if (widthDefined > 0) {
                viz.config.containerWidth = widthDefined;
                viz.$container_wrap.css({"width": widthDefined + "px"}); //, "border-left":"1px dashed rgba(0, 0, 0, 0.2)", "border-right":"1px dashed rgba(0, 0, 0, 0.2)"});
            }

            // Check to see if there is a field specifically called "title" in which case it will override
            var foundField = false;
            var hasId = false;
            for (var m = 0; m < viz.data.fields.length; m++) {
                if (viz.data.fields[m].name === "title" || viz.data.fields[m].name === "value" || viz.data.fields[m].name === "text" ) {
                    foundField = true;
                }
                if (viz.data.fields[m].name === "id") {
                    hasId = true;
                }
            }

            // Can't continue becuase of data issues
            if (! foundField) {
                viz.$container_wrap.empty();
                viz.$container_wrap.append('<div class="number_set_viz-unexpected_data_fmt">Unexpected data format.<br />Provide data with expected field names, for example: "value", "title", "text"  (see Format menu &gt; Help for supported field names) </div>');
                return;
            }

            // Can't continue becuase of data issues
            if (! hasId && viz.config.absolute === "yes") {
                viz.$container_wrap.empty();
                viz.$container_wrap.append('<div class="number_set_viz-unexpected_data_fmt">Unexpected data format.<br />For Absolute layout mode you must provide data with a field in the data called "id" </div>');
                return;
            }

            viz.$container_wrap.find('.number_set_viz-unexpected_data_fmt').remove();

            if (viz.positionsButton) {
                viz.positionsButton.remove();
            }
            
            if (viz.config.absolute === "yes") { 
                viz.positions = {};
                if (viz.config.positions !== "") {
                    try {
                        viz.positions = JSON.parse("{" + viz.config.positions + "}");
                    } catch (e) {
                        console.log("Unable to load initial positioning as it isnt a valid JSON array");
                    }
                }
                if (viz.config.coarse_positions === "yes") {
                    viz.positionMultiplier = 100;
                } else {
                    viz.positionMultiplier = 1000;
                }
                // Add a button that allows copying the current positions to the clipboard
                viz.positionsButton = $("<span class='number_set_viz-copylink btn-pill'><i class='far fa-clipboard'></i> Copy positions to clipboard</span>")
                    .appendTo(viz.$container_wrap)
                    .on("click", function(e){
                        var dump = JSON.stringify(viz.positions);
                        console.log(dump.substr(1,dump.length-2));
                        viz.copyTextToClipboard(dump.substr(1,dump.length-2));
                        e.stopPropagation();
                    }).on("mouseover",function(){
                        viz.positionsButton.css({"opacity": "1"});
                    }).on("mouseout", function(){
                        clearTimeout(viz.positionsButtonTimeout);
                        viz.positionsButtonTimeout = setTimeout(function(){
                            viz.positionsButton.css("opacity",0);
                        }, 5000);
                    });
            }

            var item, i;

            var allowedOverrides = {
                color: "color",
                height: "height",
                width: "width",
                bgcolor: "bgcolor",
                value: "value",
                sparkline: "overtimedata",
                title: "title",
                text: "text",
                id: "id",
                subtitle: "subtitle",
                tooltip: "tooltip",
                tooltip_html: "tooltip_html",
                thresholdcolor1: "thresholdcol1",
                thresholdcolor2: "thresholdcol2",
                thresholdcolor3: "thresholdcol3",
                thresholdcolor4: "thresholdcol4",
                thresholdcolor5: "thresholdcol5",
                thresholdcolor6: "thresholdcol6",
                thresholdvalue1: "thresholdval1",
                thresholdvalue2: "thresholdval2",
                thresholdvalue3: "thresholdval3",
                thresholdvalue4: "thresholdval4",
                thresholdvalue5: "thresholdval5",
                thresholdvalue6: "thresholdval6",
                info_min_time: "info_min_time",
                info_max_time: "info_max_time",
            };

            viz.item = [];
            viz.allowDrilldown = true;
            for (var itemidx = 0; itemidx < viz.data.rows.length; itemidx++) {
                item = {
                    id: itemidx,
                    overtimedata: [],
                    title: "",
                    value: null,
                    drilldowndata: {},
                    tooltip: "",
                    tooltip_html: ""
                };

                viz.item.push(item);

                // overrides are columns in the data with specific names
                for (var k = 0; k < viz.data.fields.length; k++) {
                    if (allowedOverrides.hasOwnProperty(viz.data.fields[k].name)) {
                        if (viz.data.fields[k].name === "sparkline") {
                            item[allowedOverrides[viz.data.fields[k].name]] = viz.getSparkline(viz.data.rows[itemidx][k]);
                        } else {
                            item[allowedOverrides[viz.data.fields[k].name]] = viz.data.rows[itemidx][k];
                        }
                    }
                    if (viz.data.fields[k].name !== "sparkline" && viz.data.fields[k].name !== "height" && viz.data.fields[k].name !== "width" && viz.data.fields[k].name !== "color" && viz.data.fields[k].name !== "bgcolor" && viz.data.fields[k].name.substr(0,9) !== "threshold" && viz.data.fields[k].name !== "tooltip" && viz.data.fields[k].name !== "tooltip_html") {
                        item.drilldowndata[ "row." + viz.sanitise(viz.data.fields[k].name) ] = viz.data.rows[itemidx][k];
                    }
                }
                if (item.value === null) {
                    item.value = "";
                }
                item.drilldowndata["click.name"] = item.title ? item.title : "";
                item.drilldowndata["click.value"] = item.value ? item.value : "";

                // if the data doesnt set the thresholdcol's and val's then we set them based from the viz config
                for (var thresidx = 1; thresidx <= 6; thresidx++) {
                    if (! item.hasOwnProperty("thresholdcol" + thresidx)) {
                        item["thresholdcol" + thresidx] = viz.config["thresholdcol" + thresidx];
                    }
                    if (! item.hasOwnProperty("thresholdval" + thresidx)) {
                        item["thresholdval" + thresidx] = viz.config["thresholdval" + thresidx];
                    } else {
                        item["thresholdval" + thresidx] = Number(item["thresholdval" + thresidx]);
                    }
                }

                if (! Array.isArray(item.overtimedata)) {
                    item.overtimedata = [];
                }

                if (viz.config.absolute === "yes") {
                    item.item_top = 50;
                    item.item_left = 50;
                    if (viz.positions.hasOwnProperty(item.id)) {
                        var dataxy = viz.positions[item.id].split(",");
                        item.item_top = parseFloat(dataxy[1]) / 100 * viz.config.containerHeight;
                        item.item_left = parseFloat(dataxy[0]) / 100 * viz.config.containerWidth;
                    }
                }
            }

            viz.config.aspectRatio = Number(viz.config.ratio) / 100;

            // Can't continue becuase too many rows
            if (viz.item.length > Number(viz.config.maxrows)) {
                viz.$container_wrap.empty();
                viz.$container_wrap.append('<div style="text-align: center; width:100%; color: #818d99; line-height: 3;">Too many rows of data (Total rows:' + viz.item.length + ', Limit: ' + viz.config.maxrows + ')</div>');
                return;
            }

            // set the background image if set
            if (viz.config.background !== "") {
                viz.$container_wrap.css("background", "top center no-repeat url(" + viz.config.background + ")");
            }

            // check its been at least 20 seconds since the last animation so that we dont make the viewer sick with too much animation
            viz.animationDebounceOK = true;
            if (viz.hasOwnProperty("lastDrawn") && viz.lastDrawn > (Date.now() - 13000)) {
                viz.animationDebounceOK = false;
            } else {
                viz.lastDrawn = Date.now();
            }

            // For any items still in teh container, animate them off the screen and remove them
            viz.$container_wrap.children(".number_set_viz-wrap_item").each(function(){
                var $this = $(this);
                var d = $this.data("number_set_viz-time");
                if (typeof d !== "undefined" && viz.animationDebounceOK) {
                    setTimeout(function(){
                        $this[0].addEventListener('transitionend', function(){ 
                            $(this).remove();
                        }, false);
                        $this.removeClass("number_set_viz-animatein").addClass("number_set_viz-animateout");
                    }, d);
                } else {
                    $this.remove();
                }
            });

            var best = { area: 0, cols: 0, rows: 0, width: 0, height: 0 };

            if (viz.config.absolute === "yes") { 
                viz.config.itemHeight = viz.config.heightmin;
                viz.config.itemWidth = viz.config.itemHeight * viz.config.aspectRatio;
                viz.config.itemsPerRow = viz.item.length;
                viz.config.rowsPerPage = 1;
                // sort items from top left to bottom right for a nice animation effect
                viz.item.sort(function(a,b){
                    return (a.item_left + a.item_top) - (b.item_left + b.item_top);
                });

            } else {
                for (var cols = viz.item.length; cols > 0; cols--) {
                    var rows = Math.ceil(viz.item.length / cols);
                    var hScale = (viz.config.containerWidth - 20) / (cols * viz.config.aspectRatio);
                    var vScale = (viz.config.containerHeight - 20) / rows;
                    var width;
                    var height;

                    // Determine which axis is the constraint.
                    if (hScale <= vScale) {
                        width = (viz.config.containerWidth - 20) / cols;
                        height = width / viz.config.aspectRatio;
                    } else {
                        height = (viz.config.containerHeight - 20) / rows;
                        width = height * viz.config.aspectRatio;
                    }
                    var area = width * height;
                    if (area > best.area) {
                        best = {"area":area, "width":width, "height":height, "rows":rows, "cols":cols};
                    }
                }
                best.height = Math.min(viz.config.heightmax, (viz.config.containerHeight - 20), best.height);
                // now that we have figured out the optimal size, we need to check that its bigger than the smallest size of
                // - the minimum size defined in the format menu
                // - the container height
                // - the container width (considering aspect ratio)
                var minSize = Math.min(viz.config.heightmin, (viz.config.containerHeight - 20), ((viz.config.containerWidth - 20)/viz.config.aspectRatio));
                // Check to make sure we dont breech the minimum item size when trying to fit in the available space. otherwise we need to use a scroll bar
                if (minSize > best.height) {
                    best.height = minSize;
                    best.width = best.height * viz.config.aspectRatio;
                    best.rows = Math.ceil(viz.item.length / (Math.floor((viz.config.containerWidth - 20) / best.width)));
                    viz.config.rowsPerPage = Math.max(1, Math.floor((viz.config.containerHeight - 20) / best.height));
                    viz.config.pageOffset = 0;
                    viz.config.totalPages = Math.ceil(viz.item.length / (viz.config.rowsPerPage * Math.ceil(viz.item.length / best.rows)));

                    var $paginationContainer = $("<div class='number_set_viz-paginator'>"+
                    "<i class='number_set_viz-prev fas fa-chevron-circle-left number_set_viz-prev-disabled' tooltip='Previous page'></i>"+
                    "<span class='number_set_viz-pagenum'>1 of " + viz.config.totalPages + "</span>"+
                    "<i class='number_set_viz-next fas fa-chevron-circle-right' tooltip='Next page'></i></div>").appendTo(viz.$container_wrap);
                    var prevButton = $paginationContainer.find(".number_set_viz-prev");
                    var nextButton = $paginationContainer.find(".number_set_viz-next");
                    var pageNum = $paginationContainer.find(".number_set_viz-pagenum");
                    prevButton.on("click", function(){
                        if (prevButton.hasClass("number_set_viz-prev-disabled")) { return; }
                        viz.$container_wrap.children(".number_set_viz-wrap_item").remove();
                        viz.config.pageOffset--;
                        viz.doDrawOfPage(viz.config.pageOffset);
                        pageNum.text((viz.config.pageOffset+1) + " of " + viz.config.totalPages)
                        nextButton.removeClass('number_set_viz-prev-disabled');
                        if (viz.config.pageOffset == 0) {
                            prevButton.addClass('number_set_viz-prev-disabled');
                        }
                    })
                    nextButton.on("click", function(){
                        if (nextButton.hasClass("number_set_viz-prev-disabled")) { return; }
                        viz.$container_wrap.children(".number_set_viz-wrap_item").remove();
                        viz.config.pageOffset++;
                        pageNum.text((viz.config.pageOffset+1) + " of " + viz.config.totalPages)
                        viz.doDrawOfPage(viz.config.pageOffset);
                        prevButton.removeClass('number_set_viz-prev-disabled');
                        if (viz.config.pageOffset + 2 > viz.config.totalPages) {
                            nextButton.addClass('number_set_viz-prev-disabled');
                        }
                    })
                } else {
                    viz.config.rowsPerPage = best.rows;
                }

                best.width = best.height * viz.config.aspectRatio;
                // Figure out how many items per row would fit is we better distribute items by row
                viz.config.itemsPerRow = Math.ceil(viz.item.length / best.rows);
                viz.config.itemHeight = Math.floor(best.height - viz.config.margin);
                viz.config.itemWidth = Math.floor(best.width - viz.config.margin);
                viz.config.containerLeftMargin = ((viz.config.containerWidth - (viz.config.itemsPerRow * (viz.config.itemWidth + (viz.config.margin/2)) - (viz.config.margin/2))) / 2);
            }

            /* Some custom HTML tooltips */
            viz.domTooltip = $("<div class='number_set_viz-tooltip_wrap' style='top:-1000px;left:-1000px;'></div>").appendTo(viz.$container_wrap);
            viz.$container_wrap.on("mousemove", function(evt) {
                var c_offset = viz.$container_wrap.offset();
                var c_width = viz.$container_wrap.width();
                var c_height = viz.$container_wrap.height();
                var x = evt.pageX - c_offset.left;
                var y = evt.pageY - c_offset.top;
                var pos = {};
                if (x < (c_width * 0.7)) {
                    pos.left = (x + 30) + "px";
                    pos.right = "";
                } else { 
                    pos.right = (c_width - x + 30) + "px";
                    pos.left = "";
                }
                if (y < (c_height * 0.7)) {
                    pos.top = y + "px";
                    pos.bottom = "";
                } else { 
                    pos.bottom = (c_height - y) + "px";
                    pos.top = "";
                }
                viz.domTooltip.css(pos);
            });
            
            /* When the HTML tooltip goes over an icon, set the contents of the hover window  */
            viz.$container_wrap.hoverIntent({
                // If the sparkline tooltip is being used, then we put the main tooltip only on the title field.
                selector: "[data-number_set_viz_tooltip]",
                over: function(){
                    viz.domTooltip.empty().append($("<div class='number_set_viz-tooltip_main'></div>").append($(this).attr("data-number_set_viz_tooltip")));
                },
                out: function(){
                    viz.domTooltip.empty();
                }
            });   

            viz.animationDelays = [];
            for (var i=0; i < viz.config.itemsPerRow; i++) {
                viz.animationDelays.push(Math.round(1000 * (-Math.pow(2, -10 * i/viz.item.length) + 1)))
            }

            viz.config.itemsPerPage = viz.config.rowsPerPage * viz.config.itemsPerRow;

            viz.doDrawOfPage(0);
        },



        doDrawOfPage: function(pageOffset){
            var viz = this;
            var itemOffset = viz.config.itemsPerPage * pageOffset;
            // Only draw if container has size. Otherwise its hidden
            if (viz.config.containerWidth > 0) {
                for (var i = 0; i < viz.config.itemsPerPage; i++) {
                    if ((itemOffset + i) < viz.item.length) {
                        viz.doDrawItem(itemOffset + i, i);
                    }
                }
            }
        },


        doDrawItem: function(itemId, itemOffset){
            var viz = this;
            var item = viz.item[itemId];

            item.$canvas1 = $('<canvas class="number_set_viz-canvas_areachart"></canvas>');
            item.$overlayText = $('<div class="number_set_viz-overlay_text"></div>');
            item.$overlayTitle = $('<div class="number_set_viz-overlay_title"></div>');
            item.$overlaySubTitle = $('<div class="number_set_viz-overlay_subtitle"></div>');
            item.$wrapc1 = $('<div class="number_set_viz-wrap_areachart"></div>').append(item.$canvas1);
            item.$pulse = $('<div class="number_set_viz-pulse"></div>');
            item.$container = $('<div class="number_set_viz-wrap_item"></div>');
            item.$container.append(item.$pulse, item.$wrapc1);
            viz.$container_wrap.append(item.$container);

            if (viz.config.radius > 0) {
                item.$container.add(item.$pulse).css("border-radius", viz.config.radius + "%");
            }
            if (viz.config.shadows === "dark") {
                item.$container.css("box-shadow", "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)");
            } else if (viz.config.shadows === "light") {
                item.$container.css("box-shadow", "0 10px 20px rgba(255,255,255,0.19), 0 6px 6px rgba(255,255,255,0.23)");
            }

            if (viz.config.animation !== "yes" ) {
                item.$container.addClass("number_set_viz-animatein");
            } else {
                var animationOffset = itemOffset;
                if (viz.config.absolute !== "yes") { 
                    animationOffset = itemOffset % viz.config.itemsPerRow;
                }
                if (viz.animationDebounceOK) {
                    setTimeout(function(){
                        item.$container.data("number_set_viz-time", viz.animationDelays[animationOffset]).addClass("number_set_viz-animatein");
                    }, 500 + viz.animationDelays[animationOffset]);
                } else {
                    item.$container.data("number_set_viz-time", viz.animationDelays[animationOffset]).addClass("number_set_viz-animatein");
                }

                if (viz.config.absolute === "yes" && (item.$container.css("top") !== "50px" || item.$container.css("left") !== "50px")) {
                    // add the pulse animation if the item isnt in the top left default position
                    setTimeout(function(){
                        item.$container.addClass("number_set_viz-pulsego");
                    }, 500 + (3 * viz.animationDelays[animationOffset]));
                }

            }
            // Drilldown
            item.$container.css("cursor","pointer").on("click", function(browserEvent){
                // if the person has been dragging, then disable all drilldowns until the viz is reloaded
                if (! viz.allowDrilldown) {
                    return;
                }
                var defaultTokenModel = splunkjs.mvc.Components.get('default');
                var submittedTokenModel = splunkjs.mvc.Components.get('submitted');
                for (var k in item.drilldowndata) {
                    if (item.drilldowndata.hasOwnProperty(k) ) {
                        console.log("Setting token $" +  k + "$ to \"" + item.drilldowndata[k] + "\"");
                        if (defaultTokenModel) {
                            defaultTokenModel.set(k, item.drilldowndata[k]);
                        } 
                        if (submittedTokenModel) {
                            submittedTokenModel.set(k, item.drilldowndata[k]);
                        }
                    }
                }
                viz.drilldown({
                    action: SplunkVisualizationBase.FIELD_VALUE_DRILLDOWN,
                    data: item.drilldowndata
                }, browserEvent);
            });

            //Tooltip
            var tt_text = item.tooltip_html + viz.htmlEncode(item.tooltip)
            if (tt_text !== "") {
                if (item.overtimedata.length && viz.config.sparkorder !== "no") {
                    item.$overlayTitle.attr("data-number_set_viz_tooltip", tt_text);
                } else {
                    item.$container.attr("data-number_set_viz_tooltip", tt_text);
                }
            }

            if (viz.config.absolute === "yes") { 
                
                item.$container.addClass("number_set_viz-absolute").css("z-index", itemOffset+1);

                item.$container.on("mousedown", function(event) {
                    // Dont allow dragging in view mode
                    if ($(".dashboard-body>.dashboard.view-mode").length > 0) { return; }

                    viz.domTooltip.empty();

                    var container = viz.$container_wrap[0].getBoundingClientRect();
                    var shiftX = event.clientX - item.$container[0].getBoundingClientRect().left + container.left;
                    var shiftY = event.clientY - item.$container[0].getBoundingClientRect().top + container.top + $(window).scrollTop();

                    moveAt(event.pageX, event.pageY);

                    // taking initial shifts into account
                    function moveAt(pageX, pageY) {
                        var newX = (pageX - shiftX);
                        var newY = (pageY - shiftY);

                        // max is 98 instead of 100, becuase otherwise it will be off the screen
                        var newXAdj = Math.max(0, Math.min(98, (Math.round(newX / viz.config.containerWidth * viz.positionMultiplier) / (viz.positionMultiplier / 100))));
                        var newYAdj = Math.max(0, Math.min(98, (Math.round(newY / viz.config.containerHeight * viz.positionMultiplier) / (viz.positionMultiplier / 100))));

                        viz.positions[item.id] = "" + newXAdj + "," + newYAdj;
                        // honor the coarse positions
                        item.item_left = parseFloat(newXAdj) / 100 * viz.config.containerWidth;
                        item.item_top = parseFloat(newYAdj) / 100 * viz.config.containerHeight;

                        item.$container.css({
                            "top": item.item_top + "px",
                            "left": item.item_left + "px"
                        });
                        viz.positionsButton.css("opacity",1);
                        clearTimeout(viz.positionsButtonTimeout);
                        viz.positionsButtonTimeout = setTimeout(function(){
                            viz.positionsButton.css("opacity",0);
                        }, 10000);
                    }

                    function onMouseMove(event) {
                        moveAt(event.pageX, event.pageY);
                        // once items have been moved, no longer allow drilldowns, as its annoying to lose progress.
                        viz.allowDrilldown = false;
                    }

                    $(document).on('mousemove.number_set_viz', onMouseMove);

                    // drop the item, remove unneeded handlers
                    $(document).on("mouseup.number_set_viz", function() {
                        $(document).off('mousemove.number_set_viz').off("mouseup.number_set_viz");
                    });
                });

                // If item.height is not set in the data, then set the height and width to the format menu size
                if (! item.height && ! item.width) {
                    item.height = viz.config.itemHeight;
                    item.width = viz.config.itemWidth;
                } else if (! item.height) {
                    // item width is not set in code, then calculate it based on the configured aspectratio
                    item.height = item.width / viz.config.aspectRatio;
                } else if (! item.width) {
                    // item width is not set in code, then calculate it based on the configured aspectratio
                    item.width = item.height * viz.config.aspectRatio;
                }

            } else {
                item.height = viz.config.itemHeight;
                item.width = viz.config.itemWidth;
                item.item_top = 10 + (Math.floor(itemOffset / viz.config.itemsPerRow) * (item.height + (viz.config.margin/2)));
                item.item_left = viz.config.containerLeftMargin + ((itemOffset % viz.config.itemsPerRow) * (item.width + (viz.config.margin/2)));
            }

            item.$container.css({
                "top": item.item_top + "px",
                "left": item.item_left + "px",
                "height": item.height + "px", 
                "width": item.width + "px"
            });

            if (viz.config.subtitlealign !== "hide") {
                item.$container.append(item.$overlaySubTitle);
            }
            if (viz.config.titlealign !== "hide") {
                item.$container.append(item.$overlayTitle);
            }
            if (viz.config.textalign !== "hide") {
                item.$container.append(item.$overlayText);
            }

            // Sparkline
            item.heightSpark = item.height * (viz.config.sparkHeight / 100);
            item.widthSpark = item.width * (viz.config.sparkWidth / 100) ;
            item.$canvas1[0].height = item.heightSpark;
            item.$canvas1[0].width = item.widthSpark;
            item.$wrapc1.css({
                "top": (item.height * (viz.config.sparkalignv / 100)) + "px",
                "left": (item.width * (viz.config.sparkalign / 100)) + "px",
                "height": item.heightSpark + "px",
                "width": item.widthSpark + "px",
            });

            // Text Value overlay
            var textfontsize = (item.height * 0.2 * (viz.config.textsize / 100));
            item.$overlayText.css({
                "font-size": textfontsize + "px", 
                "line-height": (textfontsize * 1.1) + "px", 
                "margin-top": (item.height * (viz.config.textalignv / 100) - (textfontsize * 0.5)) + "px", 
                "height" : (textfontsize * 2) + "px",
                "width": (item.width * 0.9) + "px",
                "margin-left": ((item.width * 0.9) / 2 * -1) + "px", 
                "left": "50%",
                "text-align": viz.config.textalign,
            }).addClass(viz.config.textfont);

            if (viz.config.textdrop === "yes") {
                item.$overlayText.css({"text-shadow": "1px 1px 1px " + viz.config.textdropcolor});
            }

            if (viz.config.textmode === "static") {
                item.$overlayText.css({"color": viz.config.textcolor});
            }
            // Title overlay
            var titlefontsize = (item.height * 0.2 * (viz.config.titlesize / 100));
            item.$overlayTitle.css({
                "font-size": titlefontsize + "px", 
                "margin-top": (item.height * (viz.config.titlealignv / 100) - (titlefontsize * 0.5)) + "px", 
                "width": (item.width * 0.9) + "px",
                "margin-left": ((item.width * 0.9) / 2 * -1) + "px", 
                "left": "50%",
                "text-align": viz.config.titlealign,
            }).addClass(viz.config.titlefont);

            if (viz.config.titledrop === "yes") {
                item.$overlayTitle.css({"text-shadow": "1px 1px 1px " + viz.config.titledropcolor});
            }
            if (viz.config.titlecolormode === "static") {
                item.$overlayTitle.css({"color": viz.config.titlecolor});
            }

            // SubTitle overlay
            var subtitlefontsize = (item.height * 0.2 * (viz.config.subtitlesize / 100));
            item.$overlaySubTitle.css({
                "font-size": subtitlefontsize + "px", 
                "margin-top": (item.height * (viz.config.subtitlealignv / 100) - (subtitlefontsize * 0.5)) + "px", 
                "width": (item.width * 0.9) + "px",
                "margin-left": ((item.width * 0.9) / 2 * -1) + "px", 
                "left": "50%",
                "text-align": viz.config.subtitlealign,
            }).addClass(viz.config.subtitlefont);

            if (viz.config.subtitledrop === "yes") {
                item.$overlaySubTitle.css({"text-shadow": "1px 1px 1px " + viz.config.subtitledropcolor});
            }
            if (viz.config.subtitlecolormode === "static") {
                item.$overlaySubTitle.css({"color": viz.config.subtitlecolor});
            }

            if (viz.config.sparkorder !== "no") {
                item.ctx1 = item.$canvas1[0].getContext('2d');
                item.areaCfg = {
                    type: viz.config.sparkstyle == "column" || viz.config.sparkstyle == "status" ? "bar" : "line",
                    data: {
                        datasets: [],
                        labels: []
                    },
                    options: {
                        responsive: true,
                        title: {
                            display: false,
                        },
                        legend: {
                            display: false,
                        },
                        tooltips: {
                            enabled: false,
                            custom: function(c){ viz.tooltip(c, this); },
                            mode: 'index',
                            intersect: false
                        },
                        hover: {
                            mode: 'index',
                            intersect: false
                        },
                        animation: {
                            duration: 0,
                        },
                        elements: {
                            line: {
                                tension: 0 // disables bezier curves
                            }
                        },
                        scales: {
                            xAxes: [{
                                display: false
                            }],
                            yAxes: [{
                                display: false,
                                ticks: {
                                }
                            }]
                        }
                    }
                };
                if (viz.config.sparkstyle == "status") {
                    item.areaCfg.options.scales.yAxes[0].ticks.min = 0;
                    item.areaCfg.options.scales.yAxes[0].ticks.max = 1;
                } else {
                    if ($.trim(viz.config.sparkmax) !== "") {
                        item.areaCfg.options.scales.yAxes[0].ticks.max = viz.config.sparkmax;
                    }
                    if ($.trim(viz.config.sparkmin) !== "") {
                        item.areaCfg.options.scales.yAxes[0].ticks.min = viz.config.sparkmin;
                    }
                }
                item.myArea = new Chart(item.ctx1, item.areaCfg);
            }

            // Figure out the thresholds
            var thresholds_arr = [{
                color: item.thresholdcol1, 
                value: -Infinity
            }];

            for (i = 2; i < 7; i++){
                if (item["thresholdval" + i] !== "" && ! isNaN(Number(item["thresholdval" + i]))) {
                    var thresholdval = Number(item["thresholdval" + i]);
                    thresholds_arr.push({
                        color: item["thresholdcol" + i], 
                        value: thresholdval
                    });
                }
            }
            //  We dont really need to sort the threshold array
            thresholds_arr.sort(function(a, b) {
                if (a.value < b.value)
                    return -1;
                if (a.value > b.value)
                    return 1;
                return 0;
            });

            //  title
            var overlayTitle = viz.config.titletext;
            if (viz.config.titletext === "" && item.title) {
                overlayTitle = item.title;
            }
            if (viz.config.labels_as_html === "yes") {
                item.$overlayTitle.html(overlayTitle);// allow html injection
            } else {
                item.$overlayTitle.text(overlayTitle);
            }

            //  subtitle
            var overlaySubTitle = viz.config.subtitletext;
            if (viz.config.subtitletext === "" && item.subtitle) {
                overlaySubTitle = item.subtitle;
            }
            if (viz.config.labels_as_html === "yes") {
                item.$overlaySubTitle.html(overlaySubTitle); // allow html injection
            } else {
                item.$overlaySubTitle.text(overlaySubTitle);
            }

            var value = Number(item.value);
            var value_color = viz.config.nodatacolor;
            if (item.value !== "" && ! isNaN(item.value)) {
                // find the colour of the value
                for (i = 0; i < thresholds_arr.length; i++){
                    if (value > thresholds_arr[i].value) {
                        value_color = thresholds_arr[i].color;
                    }
                }
            }
            // in-data override
            if (item.hasOwnProperty("color") && $.trim(item.color) !== "") {
                value_color = item.color;
            }
            
            var bg_color = "transparent";
            if (viz.config.colormode !== "transparent") { 
                bg_color = viz.getColorFromMode(viz.config.colormode, viz.config.color, value_color);
            }
            // in-data override
            if (item.hasOwnProperty("bgcolor") && $.trim(item.bgcolor) !== "") {
                bg_color = item.bgcolor;
            }

            item.$container.add(item.$pulse).css("background-color", bg_color);
            
            if (viz.config.sparkorder !== "no") {
                var block = null;
                
                if (item.hasOwnProperty("info_min_time") && item.hasOwnProperty("info_max_time")) {
                    var diff = item.info_max_time - item.info_min_time;
                    // this isnt perfect, but it should be close enough to be useful
                    block = (diff / item.overtimedata.length);
                }
                item.areaCfg.data.labels = [];
                //var tme_start = Math.floor((+item.info_min_time) / block) * block;
                for (var m = 0; m < item.overtimedata.length; m++) {
                    var tme = "";
                    if (block !== null) {
                        var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
                        d.setUTCSeconds((block * m + Number(item.info_min_time)));
                        tme = d.toLocaleString() + " - ";
                    }
                    if (viz.config.sparkstyle == "status") {
                        if (item.overtimedata[m] >= 6) {
                            item.areaCfg.data.labels.push(tme + "Error");
                        } else if (item.overtimedata[m] >= 4) {
                            item.areaCfg.data.labels.push(tme + "Warning");
                        } else if (item.overtimedata[m] >= 2) {
                            item.areaCfg.data.labels.push(tme + "Good");
                        } else if (item.overtimedata[m] >= 0) {
                            item.areaCfg.data.labels.push(tme + "Informational");
                        } else  {
                            item.areaCfg.data.labels.push(tme + "Unknown");
                        }
                    } else {
                        item.areaCfg.data.labels.push(tme + item.overtimedata[m]);
                    }
                }

                if (item.areaCfg.data.datasets.length === 0) {
                    item.areaCfg.data.datasets.push({});
                }
                item.areaCfg.data.datasets[0].label = "";
                if (viz.config.sparkstyle == "status") {
                    item.areaCfg.data.datasets[0].data = [];
                    item.areaCfg.data.datasets[0].backgroundColor = [];
                    for (var n = 0; n < item.overtimedata.length; n++) {
                        item.areaCfg.data.datasets[0].data.push(1);
                        if (item.overtimedata[n] >= 6) {
                            item.areaCfg.data.datasets[0].backgroundColor.push("#b22b32");
                        } else if (item.overtimedata[n] >= 4) {
                            item.areaCfg.data.datasets[0].backgroundColor.push("#d16f18");
                        } else if (item.overtimedata[n] >= 2) {
                            item.areaCfg.data.datasets[0].backgroundColor.push("#1a9035");
                        } else if (item.overtimedata[n] >= 0) {
                            item.areaCfg.data.datasets[0].backgroundColor.push("#009DD9");
                        } else  {
                            item.areaCfg.data.datasets[0].backgroundColor.push("#708794");
                        }
                    }
                } else {
                    item.areaCfg.data.datasets[0].borderColor = viz.getColorFromMode(viz.config.sparkcolormodeline, viz.config.sparkcolorline, value_color);
                    item.areaCfg.data.datasets[0].backgroundColor = viz.getColorFromMode(viz.config.sparkcolormodefill, viz.config.sparkcolorfill, value_color);
                    item.areaCfg.data.datasets[0].pointBorderColor = item.areaCfg.data.datasets[0].borderColor;
                    item.areaCfg.data.datasets[0].pointBackgroundColor = item.areaCfg.data.datasets[0].borderColor;
                    item.areaCfg.data.datasets[0].pointRadius = 1;
                    if (viz.config.sparknulls === "zero") {
                        item.areaCfg.data.datasets[0].data = [];
                        for (var p = 0; p < item.overtimedata.length; p++) {
                            item.areaCfg.data.datasets[0].data.push(item.overtimedata[p] === null ? 0 : item.overtimedata[p]);
                        }
                    } else {
                        item.areaCfg.data.datasets[0].data = item.overtimedata;
                    }
                    item.areaCfg.data.datasets[0].fill = viz.config.sparkstyle == "area" ? 'origin' : false;
                    item.areaCfg.data.datasets[0].spanGaps = (viz.config.sparknulls === "span");
                }
            }

            var value_display = item.value;
            // in-data override
            if (item.hasOwnProperty("text")) {
                value_display = item.text;
            }

            if ($.trim(value_display) === "") {
                item.$overlayText.html("");

            // if value_display is a number then we might need to apply number formatting
            } else if (! isNaN(value_display)) {
                item.$overlayText.html(viz.buildOverlay(value_display));

            } else {
                if (viz.config.labels_as_html === "yes") {
                    item.$overlayText.html(value_display); // allow html injection
                } else {
                    item.$overlayText.text(value_display);
                }
            }
            if (viz.config.textmode !== "static") {
                item.$overlayText.css({"color": viz.getColorFromMode(viz.config.textmode, viz.config.textcolor, value_color)});
            }
            if (viz.config.titlecolormode !== "static") {
                item.$overlayTitle.css({"color": viz.getColorFromMode(viz.config.titlecolormode, viz.config.titlecolor, value_color)});
            }
            if (viz.config.subtitlecolormode !== "static") {
                item.$overlaySubTitle.css({"color": viz.getColorFromMode(viz.config.subtitlecolormode, viz.config.subtitlecolor, value_color)});
            }

            if (viz.config.sparkorder !== "no") {
                item.myArea.update();
            }

            item.$canvas1.css("display", "block");
        },

        buildOverlay: function(val) {
            var viz = this;
            var ret = val;
            val = Number(val);
            if (viz.config.textprecision === "1") {
                ret = Math.round(val);
            } else if (viz.config.textprecision === "2") {
                ret = Math.round(val * 10) / 10;
            } else if (viz.config.textprecision === "3") {
                ret = Math.round(val * 100) / 100;
            } else if (viz.config.textprecision === "4") {
                ret = Math.round(val * 1000) / 1000;
            } else if (viz.config.textprecision === "5") {
                ret = Math.round(val * 10000) / 10000;
            } else if (viz.config.textprecision === "6") {
                ret = Math.round(val * 100000) / 100000;
            }

            if (viz.config.textprocessing === "abr1") {
                ret = viz.abbreviate(ret, 1);
            } else if (viz.config.textprocessing === "abr2") {
                ret = viz.abbreviate(ret, 2);
            } else if (viz.config.textprocessing === "abr3") {
                ret = viz.abbreviate(ret, 3);
            } else if (viz.config.textprocessing === "abr4") {
                ret = viz.abbreviate(ret, 4);
            }

            ret = ret.toString();
            if (viz.config.textprocessing === "thou") {
                ret = ret.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            }
            if (viz.config.textunit) {
                // intentially allowing html injection. yolo
                var unit = "<span class='number_set_viz-unit number_set_viz-unit-" + viz.config.textunitposition + "' style='font-size: " + viz.config.textunitsize + "%;'>" + (viz.config.textunitposition === "under" ? "<br />" : "") + viz.config.textunit + "</span>";
                if (viz.config.textunitposition === "before") {
                    ret = unit + ret;
                } else {
                    ret = ret + unit;
                }
            }
            return ret;
        },

        getSparkline: function(obj){
            if (Array.isArray(obj)) {
                if (obj[0] === "##__SPARKLINE__##") {
                    return obj.slice(1);
                } else {
                    return obj;
                }
            }
            return [];
        },

        sanitise: function(val) {
            return val.toString().replace(/\W+/g, "_");
        },

        abbreviate: function(number, decPlaces) {
            var isNegative = number < 0;
            var units = ['k', 'm', 'b', 't'];
            number = Math.abs(number);
            for (var i = units.length - 1; i >= 0; i--) {
                var size = Math.pow(10, (i + 1) * 3);
                if (size <= number) {
                    number = number / size; 
                    if ((number === 1000) && (i < units.length - 1)) {
                        number = 1;
                        i++;
                    }
                    if (number > 99) {
                        number = Math.round(number * Math.pow(10, Math.max(decPlaces - 3, 0))) / Math.pow(10, Math.max(decPlaces - 3, 0));
                    } else if (number > 9) {
                        number = Math.round(number * Math.pow(10, Math.max(decPlaces - 2, 0))) / Math.pow(10, Math.max(decPlaces - 2, 0));
                    } else {
                        number = Math.round(number * Math.pow(10, Math.max(decPlaces - 1, 0))) / Math.pow(10, Math.max(decPlaces - 1, 0));
                    }
                    number += units[i];
                    break;
                }
            }
            return isNegative ? '-' + number : number;
        },

        getColorFromMode: function(mode, color1, color2) {
            if (mode === "darker1") {
                return tinycolor(color2).darken(10).toString();
            } else if (mode === "darker2") {
                return tinycolor(color2).darken(20).toString();
            } else if (mode === "darker3") {
                return tinycolor(color2).darken(40).toString();
            } else if (mode === "lighter1") {
                return tinycolor(color2).lighten(10).toString();
            } else if (mode === "lighter2") {
                return tinycolor(color2).lighten(20).toString();
            } else if (mode === "lighter3") {
                return tinycolor(color2).lighten(40).toString();
            } else if (mode === "static") {
                return color1;
            }
            return color2;
        },
	    
        htmlEncode: function(value){
		    return $('<div/>').text(value).html();
	    },

        tooltip: function(tooltipModel, chart) {
            var tooltipEl = $('.number_set_viz-tooltip_spark');
            // Create element on first render
            if (tooltipEl.length === 0) {
                tooltipEl = $('<div class="number_set_viz-tooltip_spark"></div>').appendTo("body");
            }
        // Hide if no tooltip
            if (tooltipModel.opacity === 0 || ! tooltipModel.body) {
                tooltipEl.css("opacity","");
                return;
            }
            tooltipEl.text(tooltipModel.dataPoints[0].label);
            var position = chart._chart.canvas.getBoundingClientRect();
            var styles = {
                opacity: 1,
                top: (position.top + window.pageYOffset + tooltipModel.caretY) + 'px'
            };
            var h_offset = position.left + window.pageXOffset + tooltipModel.caretX;
            if (h_offset > (window.innerWidth * 0.8)) {
                styles.right = window.innerWidth - h_offset + 30;
                styles.left = "";
            } else {
                styles.left = h_offset + 30;
                styles.right = "";
            }
            tooltipEl.css(styles);
        },

        copyTextToClipboard: function(text) {
            var viz = this;
            if (!navigator.clipboard) {
                viz.fallbackCopyTextToClipboard(text);
            } else {
                navigator.clipboard.writeText(text).then(function() {
                    viz.toast('Copied to clipboard! (now paste into Format menu > Advanced)');
                }, function (err) {
                    console.error('Async: Could not copy node positions to clipboard. Please hit F12 and check the console log for the positions string. This should be pasted into the Advanced settings.', err);
                });
            }
        },

        fallbackCopyTextToClipboard: function(text) {
            var viz = this;
            var textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                var successful = document.execCommand('copy');
                if (successful) {
                    viz.toast('Copied to clipboard! (now paste into Format menu > Advanced)');
                } else {
                    console.error('Fallback2: Could not copy node positions to clipboard. Please hit F12 and check the console log for the positions string. This should be pasted into the Advanced settings.', err);
                }
            } catch (err) {
                console.error('Fallback: Could not copy node positions to clipboard. Please hit F12 and check the console log for the positions string. This should be pasted into the Advanced settings.', err);
            }
            document.body.removeChild(textArea);
        },

        // Toast popup message
        toast: function(message) {
            var t = $("<div style='background-color: #53a051; width: 432px;  height: 60px; position: fixed; top: 100px; margin-left: -116px;  left: 50%; line-height: 60px; padding: 0 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23); color: white; opacity: 0; transform: translateY(30px); text-align: center; transition: all 300ms;'><span></span></div>");
            t.appendTo("body").find('span').text(message);
            setTimeout(function(){
                t.css({'opacity': 1, 'transform': 'translateY(0)'});
                setTimeout(function(){
                    t.css({'opacity': 0, 'transform': 'translateY(30px)'});
                    setTimeout(function(){
                        t.remove();
                    },300);
                },3000);
            },10);
        },

        // Override to respond to re-sizing events
        reflow: function() {
            this.scheduleDraw();
        },

        // Search data params
        getInitialDataParams: function() {
            return ({
                outputMode: SplunkVisualizationBase.ROW_MAJOR_OUTPUT_MODE,
                count: 10000
            });
        },
    };


/*!
 * hoverIntent v1.10.1 // 2019.10.05 // jQuery v1.7.0+
 * http://briancherne.github.io/jquery-hoverIntent/
 *
 * You may use hoverIntent under the terms of the MIT license. Basically that
 * means you are free to use hoverIntent as long as this header is left intact.
 * Copyright 2007-2019 Brian Cherne
 */
!function(factory){"use strict";"function"==typeof define&&define.amd?define(["jquery"],factory):"object"==typeof module&&module.exports?module.exports=factory(require("jquery")):jQuery&&!jQuery.fn.hoverIntent&&factory(jQuery)}(function($){"use strict";function track(ev){cX=ev.pageX,cY=ev.pageY}var cX,cY,_cfg={interval:100,sensitivity:6,timeout:0},INSTANCE_COUNT=0,compare=function(ev,$el,s,cfg){if(Math.sqrt((s.pX-cX)*(s.pX-cX)+(s.pY-cY)*(s.pY-cY))<cfg.sensitivity)return $el.off(s.event,track),delete s.timeoutId,s.isActive=!0,ev.pageX=cX,ev.pageY=cY,delete s.pX,delete s.pY,cfg.over.apply($el[0],[ev]);s.pX=cX,s.pY=cY,s.timeoutId=setTimeout(function(){compare(ev,$el,s,cfg)},cfg.interval)};$.fn.hoverIntent=function(handlerIn,handlerOut,selector){var instanceId=INSTANCE_COUNT++,cfg=$.extend({},_cfg);$.isPlainObject(handlerIn)?(cfg=$.extend(cfg,handlerIn),$.isFunction(cfg.out)||(cfg.out=cfg.over)):cfg=$.isFunction(handlerOut)?$.extend(cfg,{over:handlerIn,out:handlerOut,selector:selector}):$.extend(cfg,{over:handlerIn,out:handlerIn,selector:handlerOut});function handleHover(e){var ev=$.extend({},e),$el=$(this),hoverIntentData=$el.data("hoverIntent");hoverIntentData||$el.data("hoverIntent",hoverIntentData={});var state=hoverIntentData[instanceId];state||(hoverIntentData[instanceId]=state={id:instanceId}),state.timeoutId&&(state.timeoutId=clearTimeout(state.timeoutId));var mousemove=state.event="mousemove.hoverIntent.hoverIntent"+instanceId;if("mouseenter"===e.type){if(state.isActive)return;state.pX=ev.pageX,state.pY=ev.pageY,$el.off(mousemove,track).on(mousemove,track),state.timeoutId=setTimeout(function(){compare(ev,$el,state,cfg)},cfg.interval)}else{if(!state.isActive)return;$el.off(mousemove,track),state.timeoutId=setTimeout(function(){!function(ev,$el,s,out){var data=$el.data("hoverIntent");data&&delete data[s.id],out.apply($el[0],[ev])}(ev,$el,state,cfg.out)},cfg.timeout)}}return this.on({"mouseenter.hoverIntent":handleHover,"mouseleave.hoverIntent":handleHover},cfg.selector)}});


    return SplunkVisualizationBase.extend(vizObj);
});