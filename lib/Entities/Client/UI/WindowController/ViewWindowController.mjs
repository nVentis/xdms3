import WindowControllerInterface from "./WindowControllerInterface.mjs";
import InvalidStateException from "../../../Exceptions/InvalidStateException.mjs";

/**
 * @typedef {object} ViewWindowOptions
 * @property {HTMLElement} Container
 * @property {string} Theme
 * @property {boolean} controlToggle
 * @property {boolean} controlMin
 * @property {boolean} controlClose
 * @property {boolean} statusBar
 * @property {boolean} Resizable
 * @property {boolean} Draggable
 * @property {string|HTMLElement} Content
 * @property {boolean} useFullSize
 * @property {number} transitionDuration
 * @property {string} easingFunction
 * @property {string[]} windowClasses
 * @property {string[]} contentClasses
 * @property {object<string, string|number>} windowStyles
 * @property {object<string, string|number>} contentStyles
 * @property {string} [URL] - If an URL is supplied, Content will be overwritten to an iframe pointing to the desired location
 */

/**
 * @type {ViewWindowOptions}
 * */
let ViewWindowsControllerDefaults = {
	Container: document.body,
	Theme: "Infinity",
	controlToggle: false,
	controlMin: false,
	controlClose: true,
	statusBar: true,
	Resizable: false,
	Draggable: true,
	Content: "",
	useFullSize: false,
	transitionDuration: 250,
	easingFunction: "easeOutExpo",
	resizeContentElement: true,
	windowClasses: [],
	contentClasses: [],
	windowStyles: {
		width: "512px",
		height: "192px"
	},
	contentStyles: {},
}

class ViewWindowController extends WindowControllerInterface {
	/**
	 * Set after first call to getWindow()
	 * @type {HTMLElement}
	 */
	windowElement = null;

	/**
	 *
	 * @type {boolean}
	 */
	windowMounted = false;

	/**
	 *
	 * @param {string} windowName
	 * @param {ViewWindowOptions} windowOptions
	 */
	constructor(
		windowName,
		windowOptions = {}
	) {
		super(windowName);

		/**
		 * @type {ViewWindowOptions}
		 */
		this.windowOptions = Object.assign({}, ViewWindowsControllerDefaults, windowOptions);

		this.windowOptions.windowClasses = ViewWindowsControllerDefaults.windowClasses.concat(windowOptions.windowClasses || []);
		this.windowOptions.contentClasses = ViewWindowsControllerDefaults.contentClasses.concat(windowOptions.contentClasses || []);

		this.windowOptions.windowStyles = Object.assign({}, ViewWindowsControllerDefaults.windowStyles, windowOptions.windowStyles || {});
		this.windowOptions.contentStyles = Object.assign({}, ViewWindowsControllerDefaults.contentStyles, windowOptions.contentStyles || {});

		if (this.windowOptions.URL) {
			let iFrame = document.createElement("iframe");
				iFrame.src = this.windowOptions.URL;

			iFrame.style.border = "0";
			iFrame.style.margin = "0";
			iFrame.style.padding = "0";
			iFrame.style.width = "100%";
			iFrame.style.height = "100%";

			this.windowOptions.Content = iFrame;
		}
	}

	getRootElement() {
		if (!this.windowElement)
			throw new InvalidStateException("getRootElement");

		if (this.windowOptions.URL)
			return this.windowElement.querySelector("iframe").contentDocument.body;
		else
			return this.windowElement.querySelector("div.contentWrapper > div.Content");
	}

	async getWindow () {
		let This = this;

		if (This.windowMounted)
			return This.windowElement;

		let windowOptions = this.windowOptions;

		let Controls = "";

		if (windowOptions.statusBar && (
			windowOptions.controlToggle ||
			windowOptions.controlMin ||
			windowOptions.controlClose))
			Controls += '<div class="Menu">' + (windowOptions.controlMin ? '<div class="Minimize"><div></div><div></div></div>' : "") + (windowOptions.controlToggle ? '<div class="Toggle ' + (windowOptions.maxSize ? "Smaller" : "Bigger") + '"><div></div><div></div></div>' : "") + (windowOptions.controlClose ? '<div class="Close"><div></div><div></div></div>' : "") + "</div>";

		if (windowOptions.hasOwnProperty("Icon"))
			windowOptions.iconStyle = "background:url('" + xDMS.UI.iconPath(windowOptions.Icon) + "');";

		let windowId = Math.round(Math.random() * 10000);
		while ($("#Window" + windowId).length)
			windowId = windowId = Math.round(Math.random() * 10000);

		this.windowElement = $(`<div
			class="Window ${windowOptions.Theme}${windowOptions.maxSize ? " maxSize" : ""}" id="Window${windowId}">
			<div class="Info">
				<div class="Title notSelectable">
					${(windowOptions.hasOwnProperty("iconStyle") ? `<div class="Icon" style="${windowOptions.iconStyle}">${windowOptions.Title || This.windowName}</div>` : (windowOptions.Title || This.windowName))}
				</div>
				${Controls}
			</div>
			<div class="contentWrapper">
				<div class="Content"></div>
			</div>
		</div>`).appendTo(windowOptions.Container)[0];

		let contentElement = this.windowElement.querySelector("div.contentWrapper > div.Content");

		windowOptions.windowClasses.forEach((someClass) => this.windowElement.classList.add(someClass));
		windowOptions.contentClasses.forEach((someClass) => contentElement.classList.add(someClass));

		Object.keys(windowOptions.windowStyles).forEach((styleProperty) => this.windowElement.style[styleProperty] = windowOptions.windowStyles[styleProperty]);
		Object.keys(windowOptions.contentStyles).forEach((styleProperty) => contentElement.style[styleProperty] = windowOptions.contentStyles[styleProperty]);

		if (typeof windowOptions.Content === "string")
			contentElement.innerHTML = windowOptions.Content;
		else if (windowOptions.Content instanceof HTMLElement)
			contentElement.appendChild(windowOptions.Content);

		if (windowOptions.useFullSize) {
			this.windowElement.style.width = "100%";
			this.windowElement.style.height = "100%";
		}

		// Post append actions
		let createPromise = new Promise(function (onSuccess) {
			$(This.windowElement).animate({
					opacity: 1,
				/**
					left: Math.max(0, (($(xDMS.UI.defaultContainer).width() - Window.outerWidth()) / 2) + $(xDMS.UI.defaultContainer).scrollLeft()),
					top: 100*/
				},
				windowOptions.transitionDuration,
				windowOptions.easingFunction,
				function () {
					This.windowMounted = true;
					return onSuccess();
				}
			);
		});

		await createPromise;

		// Set Window to the DOM representation of the jQuery object
		/*
		Window = Window[0];

		Window.Options = windowOptions;
		windowOptions.isResizable = windowOptions.isResizableCurrentlyDisabled = false;

		Window.isUserClosing = true;*/
		//console.log(windowOptions);

		this.Close = function () {
			this.isUserClosing = true;

			this.windowElement.parentNode.removeChild(this.windowElement);
		}

		this.toggleSize = function () { return xDMS.UI.Window.toggleSize(This); }
		this.toggleToggleButton = function (forceToBigger) { return xDMS.UI.Window.toggleToggleButton(This, forceToBigger); }
		this.resetSize = function (skipPositionReset, additionalProperties) { xDMS.UI.Window.resetSize(This, skipPositionReset, additionalProperties); }
		this.maxSize = windowOptions.maxSize || false;
		this.onRemove =
			((typeof windowOptions.onRemove === "function") ? [windowOptions.onRemove] : ((windowOptions.onRemove instanceof Array) ? windowOptions.onRemove : []));

		this.snappedLeft = false;
		this.snappedRight = false;

		if (windowOptions.Draggable) {
			$(This.windowElement).draggable({handle: ".Info", scroll: false});

			if (false) {
				// Make it possible to toggle a window (to windowed mode) by dragging it a bit in fullscreen mode
				var $titleBar = $(this.windowElement.querySelector(".Info"));

				$(this.windowElement).on("dragstart", function (ePre) {
					let xPre = ePre.clientX,
						yPre = ePre.clientY;

					if (yPre > 16)
						$(This.windowElement).on("drag", function (eCur) {
							if (eCur.clientY < 16) {
								This.toggleSize();
								This.toggleToggleButton();
								$(This.windowElement).off("drag");

								return false;
							}
						});

					if (xPre > 16)
						$(This.windowElement).on("drag", function (eCur) {
							if (eCur.clientX < 16) {
								Window.snappedLeft = true;
								This.maxSize = false;
								$(This.windowElement).animate({
									top: 0,
									left: 0,
									height: "100%",
									width: "50%"
								}, xDMS.UI.transitionDuration, xDMS.UI.easingFunction).off("drag");
								//Window.toggleToggleButton();
								return false;
							}
						});
				}).on("dragstop", function () {
					Window.jQuery().off("drag");
					if (Window.getBoundingClientRect().top < 0)
						Window.style.top = "0px";
				});

				$titleBar.on("mousedown.xDMS", function (ePre) {
					if ($(ePre.target).hasClass("Menu")) return;
					var winOffsetPre = Window.getBoundingClientRect(),
						xPre = ePre.clientX,
						yPre = ePre.clientY,
						clearHandle = function () {
							$titleBar.trigger("mouseup.xDMS").off("mousemove.xDMS mouseleave.xDMS");
							Window.jQuery().off("mousemove.xDMS");
						}

					if (!Window.maxSize && !Window.snappedLeft && !Window.snappedRight && xPre > 16 && yPre > 16)
						Window.Location = Window.getBoundingClientRect();

					$titleBar.one("mouseup.xDMS mouseleave.xDMS", function () {
						Window.jQuery().off("mousemove.xDMS");
					});

					Window.jQuery().on("mousemove.xDMS", function (ePost) {
						var xPost = ePost.clientX,
							yPost = ePost.clientY;

						if (Window.maxSize) {
							if (Math.abs(yPost - yPre) > 1) {
								clearHandle();
								var xNew = xPost - Math.abs(xPre - xPost),
									yNew = yPost;

								while ((xNew + parseInt(Window.Location.width)) > winOffsetPre.width)
									xNew -= 10;

								var animationProperties = {
									width: Window.Location.width || Window.Options.windowStyle.width || xDMS.UI.Window.Standard.windowStyle.width,
									height: Window.Location.height || Window.Options.windowStyle.height || xDMS.UI.Window.Standard.windowStyle.height,
									top: yNew,
									left: xNew
								}

								Window.toggleToggleButton();
								Window.maxSize = false;
								Window.jQuery().animate(animationProperties, xDMS.UI.transitionDuration, xDMS.UI.easingFunction);

								if (Window.Options.Resizable)
									Window.jQuery().resizable("enable");
							}
							;
						} else {
							var curWindowProperties = Window.getBoundingClientRect();
							if (Window.snappedLeft || Window.snappedRight) {
								if (Math.abs(xPost - xPre) > 4) {
									clearHandle();
									Window.maxSize = Window.snappedLeft = Window.snappedRight = false;
									Window.resetSize();
								}
							} else if (curWindowProperties.top < 0 || curWindowProperties.left < 0) {
								clearHandle();
								Window.maxSize = false;

								if (curWindowProperties.top < 0)
									Window.style.top = "0px";
								else if (curWindowProperties.left < 0)
									Window.style.left = "0px";
							}
						}
					});
				});
			}
		}

		This.isResizable = false;
		This.isResizableCurrentlyDisabled = false;
		if (windowOptions.Resizable)
			This.toggleResizable();

		if (windowOptions.controlClose)
			$(this.windowElement.querySelector(".Info .Menu .Close")).on("click", function () {
				This.Close();
			});
		if (windowOptions.controlToggle) {
			$(this.windowElement.querySelector(".Info")).on("dblclick", function () {
				This.toggleToggleButton();
				This.toggleSize();
			});

			$(this.windowElement.querySelector(".Info .Menu .Toggle")).on("click", function () {
				This.toggleToggleButton();
				This.toggleResizable();
				This.toggleSize();
			});
		}

		/*
		xDMS.UI.Window.Controllable(Window);
		if (xDMS.UI.resPos && ((Options.resPos) || xDMS.UI.Window.Standard.resPos.Enable) && (typeof Options.windowStyle === "object" || typeof Options.resPos.Queries === "object"))
			xDMS.UI.resPos.Set(Window, {
				Queries: Options.resPos.Queries || Options.windowStyle,
				Check: Options.resPos.Check || function () {
					return !Window.maxSize;
				}
			});*/

		/*
		if (Options.Draggable || xDMS.UI.Window.Standard.Draggable) {
			xDMS.UI.Window.Draggable(Window);
			Window.snappedLeft = Window.snappedRight = false;
		}

		if (Options.Resizable) xDMS.UI.Window.toggleResizable(Window);
		if (Options.hasOwnProperty("onCreate") && typeof Options.onCreate === "function") Options.onCreate(Window);

		 */

		return This.windowElement;
	}

	toggleResizable () {
		let This = this;
		let windowElement = this.windowElement;
		if (!windowElement)
			throw new InvalidStateException("windowElement");

		if (This.isResizable) {
			$(windowElement).resizable("disable");
			This.isResizableCurrentlyDisabled = true;
		} else {
			if (This.isResizableCurrentlyDisabled) {
				$(windowElement).resizable("enable");
				This.isResizableCurrentlyDisabled = false;
			} else {
				var resizableConfiguration = {
					autoHide: true,
					handles: "n, nw, w, sw, s, se, e, ne"
				}

				// Check if resizeContentElement is true; if true, the content element itself will also be resized directly according to the cursor position
				if (This.windowOptions.resizeContentElement === true) {
					resizableConfiguration.start = function (eventStart) {
						let contentElement = This.getRootElement(),
							startLocation = contentElement.getBoundingClientRect();

						if (eventStart.clientY >= (startLocation.top + startLocation.height) - 16) {
							windowElement.resizeHandleFunction = function (Event) {
								contentElement.style.height = Math.abs(Event.clientY - startLocation.top) + "px";
							}

							document.addEventListener("mousemove", Window.windowElement);
						}
					}
					resizableConfiguration.stop = function () {
						document.removeEventListener("mousemove", Window.windowElement);
					}
				}

				$(windowElement).resizable(resizableConfiguration);
			}
		}

		windowElement.isResizable = !windowElement.isResizable;
		return true;
	}
}

export default ViewWindowController;