/**
 * @module Client/UI/UIXElement
 */

// Requires twig to be loaded correctly

class UIXElement {
	/**
	 * @param {HTMLElement} uiElement
	 */
	constructor(uiElement) {
		if (uiElement.UIXInstance)
			return uiElement.UIXInstance;

		// Add cross references to ensure there is only one UIXElement instance per HTMLElement
		this.HTMLElement = uiElement;
		uiElement.UIXInstance = this;

	}
}

export { UIXElement }