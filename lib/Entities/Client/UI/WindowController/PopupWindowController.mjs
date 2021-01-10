import WindowControllerInterface from "./WindowControllerInterface.mjs";
import InvalidStateException from "../../../Exceptions/InvalidStateException.mjs";

class PopupWindowController extends WindowControllerInterface{
	/**
	 * To open a window, create an instance and on a user interaction, call getWindow()
	 * @param {string} windowName
	 * @param {object} windowOptions
	 * @param {string} windowOptions.URL
	 * @param {string} [windowOptions.Features]
	 *
	 */
	constructor(
		windowName,
		windowOptions = {}
	) {
		super(windowName);

		let This = this;

		this.Reference = null;

		if (!windowOptions.Features)
			windowOptions.Features = "menubar=yes,location=no,resizable=yes,scrollbars=no,status=no,height=400,width=500";

		this.windowURL = windowOptions.URL;
		this.windowFeatures = windowOptions.Features;

		this.getRootElement = function () {
			if (!This.Reference)
				throw new InvalidStateException("Window");

			return This.Reference.document.getElementsByTagName("body")[0];
		}

		/**
		 * @returns {Window}
		 */
		this.getWindow = async function () {
			if (!This.Reference)
				This.Reference = window.open(this.windowURL, this.windowName, this.windowFeatures);

			let somePromise = new Promise(function (onSuccess, onError) {
				This.Reference.onload = onSuccess;
			});

			await somePromise;

			This.Reference.focus(); //focus the body

			return This.Reference;
		}

		this.closeWindow = function () {
			This.Reference.close();
		}
	}
}

export default PopupWindowController;