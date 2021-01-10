/**
 * See class
 * @module Client/UI/ReactableDOMInterface
 */

import ViewComponent from "./ViewComponent.mjs";

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const COMMENT_NODE = 8;
export const DOCUMENT_NODE = 9;
export const DOCUMENT_FRAGMENT_NODE = 11;

/**
 *
 * @type {Array}
 */
let renderQueue = [];

class ViewRenderRequest {
    constructor() {

    }
}

/**
 *
 * @param {HTMLElement|HTMLDocument} rootContainerElement
 * @returns HTMLElement
 */
function getOwnerDocumentFromRootContainer(
    rootContainerElement
) {
    return rootContainerElement.nodeType === DOCUMENT_NODE ? (rootContainerElement) : rootContainerElement.ownerDocument;
}
/**
 *
 * @param {string|HTMLElement} type
 * @param {object} props
 * @param {Element|Document} rootContainerElement
 * @param {string} parentNamespace
 * @returns {HTMLElement}
 */
function createElement(
    type,
    props = {},
    rootContainerElement,
    parentNamespace
) {
    let Element,
        ownerDocument = getOwnerDocumentFromRootContainer(rootContainerElement);

    if (type instanceof HTMLElement)
        Element = type;
    else if (type === "script") {
        const div = ownerDocument.createElement('div');
        div.innerHTML = '<script><' + '/script>';

        const firstChild = div.firstChild;
        Element = div.removeChild(firstChild);
    } else if (typeof props.is === "string") {
        Element = ownerDocument.createElement(type, { is: props.is });
    } else {
        Element = ownerDocument.createElement(type);
    }

    return Element;
}

async function renderSubtreeIntoContainer () {

}

/**
 * Attempts to render the specified element into the container
 * @param ViewElement
 * @param Container
 * @returns {Promise<void>}
 */
async function render (
    Element,
    Container
) {

}

export {
    createElement,
    render
}