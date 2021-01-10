/**
 * @module Client/UI/UIXGenericContainer
 */

import {EventNamespace} from "../../Event/Namespace.mjs";

var UIXGenericContainerDefaults = new Map();
	UIXGenericContainerDefaults.set("Namespace", "../../../../../views/");

/**
 * A generic container for UIXElement entities
 */
class UIXGenericContainer extends EventNamespace{
	constructor() {
		super();

		this.Config = new Map(UIXGenericContainerDefaults);

		this.addElement = function () {

		}
	}
}

export {
	UIXGenericContainer,
	UIXGenericContainerDefaults
}