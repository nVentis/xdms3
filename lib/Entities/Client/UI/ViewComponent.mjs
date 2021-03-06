/**
 * See class
 * @module Client/UI/ViewComponent
 */

import Store, {PatchedStoreUpdate, STATE_CHANGE} from "../Store.mjs";
import {createElement, render} from "./ViewDOM.mjs";
import NotImplementedException from "../../Exceptions/NotImplementedException.mjs";
import InvalidStateException from "../../Exceptions/InvalidStateException.mjs";
import InvalidTypeException from "../../Exceptions/InvalidTypeException.mjs";
import { EventNamespace } from "../../Event/Namespace.mjs";
import AssetManager from "./AssetManager.mjs";
import xInteraction from "./xInteraction.mjs";

let reservedComponentProps = ["store", "element", "dispatch"];

/**
 * Here, it's required for the syncParse method, enabling rapid DOM replication for easy structures
 * @type {AssetManager}
 */
let localAssetManager = new AssetManager();

export const COMPONENT_WILL_MOUNT = "COMPONENT_WILL_MOUNT";
export const COMPONENT_WILL_UNMOUNT = "COMPONENT_WILL_UNMOUNT";
export const COMPONENT_DID_MOUNT = "COMPONENT_DID_MOUNT";
export const COMPONENT_DID_UPDATE = "COMPONENT_DID_UPDATE";

/**
 * Attempts to convert the input to a HTMLElement
 * @returns {HTMLElement}
 */
let defaultStreamline = function (input) {
	let output;

	// TODO: Render bit-by-bit, i.e., parse the input, then analyse and re-create the structure

	if (typeof input === "string" || typeof input === "number") {
		let containerElement = document.createElement("div");
		containerElement.innerHTML = input;

		output = containerElement.children[0];
	} else if (input instanceof HTMLElement || input instanceof HTMLElement) {
		output = input;
	} else
		throw new NotImplementedException("Unknown type");

	return output;
}

/**
 * @classdesc The base class for implementing ViewComponents. May be used with connected Store entities or other
 * Stores inheriting from that (e.g. StoreReducable)
 *
 * @name ViewComponent
 * @class
 */
class ViewComponent {
	/**
	 * @typedef {object} ViewComponentConstructorProps
	 * @property state - The default state of this component
	 * @property {function} render - A function returning DOM Node elements
	 * @property {HTMLElement} element - The element in which this component may be renderer
	 * @property {Object<string, ViewComponent>} connectedComponents
	 */

	/**
	 * Supplied by constructor, e.g. when called by a parent
	 * @param {ViewComponentConstructorProps} props
	 */
	constructor(
		props = {}
	) {
		if (!props.element)
			throw new InvalidTypeException("props.element");

		let This = this;

		let Events = new EventNamespace();

		// Process supplied listeners (if any)
		let willMountListener = this.componentWillMount,
			willUnmountListener = this.componentWillUnmount,
			didMountListener = this.componentDidMount,
			didUpdateListener = this.componentDidUpdate;

		/**
		 * Registers a callback for execution at mount time (injection to the DOM), i.e. just before calling .render()
		 * @param {function} Callback
		 * @returns {ListenerEntry}
		 */
		this.componentWillMount = function (Callback) {
			return Events.On(COMPONENT_WILL_MOUNT, Callback);
		};

		if (willMountListener)
			this.componentWillMount(willMountListener.bind(this));

		/**
		 * As componentWillMount, but before unmounting
		 * @param {function} Callback
		 * @returns {ListenerEntry}
		 */
		this.componentWillUnmount = function (Callback) {
			return Events.On(COMPONENT_WILL_UNMOUNT, Callback);
		};

		if (willUnmountListener)
			this.componentWillUnmount(willUnmountListener.bind(this));


		/**
		 * Fired at the end of the first update process
		 * @callback ViewComponent~componentDidMountCallback
		 */

		/**
		 * As componentWillMount, but after mounting
		 * @param {ViewComponent~componentDidMountCallback} Callback
		 * @returns {ListenerEntry}
		 */
		this.componentDidMount = function (Callback) {
			return Events.On(COMPONENT_DID_MOUNT, Callback);
		};

		if (didMountListener)
			this.componentDidMount(didMountListener.bind(this));

		/**
		 * Fired at the end of every update process (except for the first)
		 * @callback ViewComponent~componentDidUpdateCallback
		 * @param {object} prevProps
		 * @param {object} prevState
		 */

		/**
		 * Attaches a listener for the COMPONENT_DID_UPDATE event
		 * @param {ViewComponent~componentDidUpdateCallback} Callback
		 * @returns {ListenerEntry}
		 */
		this.componentDidUpdate = function (Callback) {
			return Events.On(COMPONENT_DID_UPDATE, Callback);
		};

		if (didUpdateListener)
			this.componentDidUpdate(didUpdateListener.bind(this));

		/**
		 * May be overwritten to check for invariant rendering under variation of state
		 * @type {function(): boolean}
		 */
		this.shouldComponentUpdate = this.shouldComponentUpdate || function (nextProps) {
			// Returning false does not prevent child components from re-rendering when their state changes.
			return true;
		};

		/**
		 *
		 * @type {Node}
		 */
		let lastRenderResult = undefined;

		/**
		 * Used as reference for triggering COMPONENT_DID_MOUNT or COMPONENT_DID_UPDATE
		 * @type {boolean}
		 */
		let hasAlreadyRendered = false;

		/**
		 *
		 * @type {object<string, xInteractionEntry>}
		 */
		let xInteractions = {};

		// LOCAL COMPONENT STATE MECHANICS START

		/**
		 * Requires a state to be manually registered before calling this
		 * @param {function|object} funcOrState - If a function, called with prevState and props
		 */
		this.setState = function (funcOrState) {
			if (typeof this.state !== "object")
				throw new InvalidTypeException("state");

			let newState = funcOrState;
			if (typeof funcOrState === "function")
				newState = funcOrState(this.state, this.props);

			let curState = this.state,
				curStateKeys = Object.keys(curState),
				newStateKeys = Object.keys(newState);

			while (curStateKeys.length) {
				let cKey = curStateKeys.pop();
				if (!curStateKeys.includes(cKey))
					delete curState[cKey];
			}

			// Apply new state bit by bit - Use PatchedStoreUpdate
			while (newStateKeys.length - 1) {
				let cKey = newStateKeys.pop();
				if (JSON.stringify(newState[cKey]) !== JSON.stringify(curState)) {
					let updateValue = new PatchedStoreUpdate(newState[cKey]);
					This.state[cKey] = updateValue;
				}
			}

			// Only one item remaining -> apply change
			if (newStateKeys.length) {
				let lastKey = newStateKeys.pop();
				This.state[lastKey] = newState[lastKey];
			}

			/*
			while (newStateKeys.length) {
				let cKey = newStateKeys.pop();
				// TODO: Better object comparison
				if (JSON.stringify(newState[cKey]) !== JSON.stringify(curState)) {
					this.state[cKey] = newState[cKey];
				}
			}*/

			// Update state for the first time manually
			this.update();
		}

		this.getState = () => this.state;

		// LOCAL COMPONENT STATE MECHANICS END

		/**
		 * Attaches an UI interaction through the xDMS UI Interaction system
		 * @param {xInteraction} xInteractionInstance
		 *
		 */
		this.setAction = function (
			xInteractionInstance
		){
			if (!xInteractionInstance.Name)
				throw new InvalidTypeException("xInteractionInstance.Name");

			xInteractionInstance.Identifier = Symbol();
			xInteractionInstance.This = This;

			xInteractions[xInteractionInstance.Name] = xInteractionInstance;
		}

		this.update = function () {
			if (!This.element)
				throw new InvalidTypeException("This.element");

			let shouldUpdate = This.shouldComponentUpdate(This.props);

			if (lastRenderResult === null)
				Events.Trigger(COMPONENT_WILL_MOUNT);

			// shouldComponentUpdate will be ignored when the component has not yet been mounted!
			if (shouldUpdate || lastRenderResult === null) {
				var renderStreamline = defaultStreamline(This.render(lastRenderResult)),
					renderCurrent = This.element.children;

				if (renderCurrent.length > 1)
					console.warn("Skipping childNodes. Support for multiple child nodes pending");

				// Only select the main element
				renderCurrent = renderCurrent[0];

				/** DIFFING FIRST ATTEMPT
				 *
				 * Assumptions
				 * 1. DOM changes will be linear and predictable; i.e., the structure of the DOM stays the same,
				 * except for marked elements with associated key fields. These items may be appended and removed.
				 *
				 * 2. Ordering of dynamic elements will remain constant
				 * 3. marking one element as dynamic marks all descendents as "equally-ranking" dynamic, i.e. all
				 * 		direct descendents have the exactly the same structure (multi-dimensional possible, but the same!)
				 * 4. After the first render, all children of dynamic elements have an unique & NUMERIC key attribute
				 *
				 ***/

				/** DIFFING SECOND ATTEMPT
				 * 1. DOM changes will be linear for items with attribute "dynamic"
				 * 1a. Children of "dynamic" elements have a unique "key" attribute, which can be used to leave the order of items intact
				 * 2. For other (non-dynamic) children, if tagName is different, the element from renderStreamline will be placed at the position
				 * 2a. Elements of renderStreamline and renderCurrent will be compared until the rest of renderStreamline, with any rest of renderCurrent being dumped
				 * 3. DOM changes will be skipped for items with attribute "static"
				 *
				 */

				let Start = performance.now();
				if (hasAlreadyRendered) {
					// Normalize outputs
					This.element.normalize();
					renderStreamline.normalize();

					/**
					 *
					 * @param {HTMLElement} treeSource
					 * @param {HTMLElement} treeTarget
					 * @returns {HTMLElement} The merged treeTarget
					 */
					let diff = function (treeSource, treeTarget) {
						// Build the DOM using the new render result and compare against the last rendering
						for (let dEI = 0; dEI < treeSource.children.length; dEI++) {
							/**
							 * @type {HTMLElement}
							 */
							let elementTarget = treeTarget.children[dEI],
								elementSource = treeSource.children[dEI];

							/**
							 * If elementSource is undefined (i.e. treeSource contains more items than treeTarget), import elementSource
							 */
							if (!elementTarget) {
								treeTarget.appendChild(elementSource);
								continue;
							} else {
								/**
								 * If elementSource is different from elementTarget, import elementTarget
								 */
								if (elementTarget.tagName !== elementSource.tagName) {
									//treeTarget.insertBefore(elementSource, elementTarget);
									elementTarget.replaceWith(elementSource);
									continue;
								}
							}

							// At this stage, elementSource and elementTarget have the same tagName
							// Now, use different mechanisms for dynamic and non-dynamic elements
							if (elementSource.hasAttribute("dynamic")) {
								if (!elementTarget.hasAttribute("dynamic")) {
									console.warn("Diffing may not work for dynamic and non-dynamic elements. Falling back to non-dynamic behavior");
								} else {
									/**
									 *
									 * @type {string[]}
									 */
									let dynamicTargetList = [],
										dynamicSourceList = [];

									// Delete all children of dynamic elements that do not have a key attribute
									for (/** @type {HTMLElement} */ let dynamicSourceChild of elementSource.children) {
										let childKey = dynamicSourceChild.getAttribute("key");
										if (childKey === null) {
											console.warn("Removing key-less child@pre");
											elementSource.removeChild(dynamicSourceChild);
										} else
											dynamicSourceList.push(/*+*/ childKey);
									}

									for (/** @type {HTMLElement} */ let dynamicTargetChild of elementTarget.children) {
										let childKey = dynamicTargetChild.getAttribute("key");
										dynamicTargetChild.key = childKey; // Attach ID directly to HTMLElement

										if (childKey === null) {
											console.warn("Removing key-less child@post");
											elementTarget.removeChild(dynamicTargetChild);
										} else
											dynamicTargetList.push(/*+*/ childKey);
									}

									// Add items missing from the new render + remove items not existent there
									for (let kIPost = 0; kIPost < dynamicSourceList.length; kIPost++) {
										let keySource = dynamicSourceList[kIPost];
										if (dynamicTargetList.indexOf(keySource) === -1) {
											// Create key reference on element
											let clonedContentTreeRoot = localAssetManager.cloneTreeSync(elementSource.querySelector(`[key="${keySource}"]`)),
												childKey = clonedContentTreeRoot.getAttribute("key");

											clonedContentTreeRoot.key = childKey;

											elementTarget.appendChild(clonedContentTreeRoot);
										}
									}

									for (let kIPre = 0; kIPre < dynamicTargetList.length; kIPre++) {
										let keyTarget = dynamicTargetList[kIPre];
										if (dynamicSourceList.indexOf(keyTarget) === -1) {
											elementTarget.removeChild(elementTarget.querySelector(`[key="${keyTarget}"]`));
										}
									}

									// At this stage, both trees should have the same number of children

									// Correct order according to elementSource.children
									let orderCorrect = true;
									for (let kIPost = 0; kIPost < dynamicSourceList.length; kIPost++) {
										let cTargetKey = dynamicTargetList[kIPost],
											cSourceKey = dynamicSourceList[kIPost];

										if (cTargetKey !== undefined) {
											if (cTargetKey !== cSourceKey) {
												orderCorrect = false;
												break;
											}
										}
									}

									if (!orderCorrect) {
										if (elementSource.children.length !== elementTarget.children.length)
											console.warn("Inequal number of elements");

										console.log("Order not correct");

										for (let kIPost = 0; kIPost < dynamicSourceList.length - 1; kIPost++) {
											let cSourceKey = dynamicSourceList[kIPost],
												nSourceKey = dynamicSourceList[kIPost+1];

											elementTarget.insertBefore(
												elementTarget.querySelector(`[key="${cSourceKey}"]`),
												elementTarget.querySelector(`[key="${nSourceKey}"]`)
											);
										}
									}

									// At this stage, both trees should have the same number of children in the correct order
									// Now, diff styles/attributes etc.

									// Check against children of newly rendered dynamic elements
									localAssetManager.mergeTreesSync(elementSource, elementTarget);

									continue;
								}
							} else {
								// Non-dynamic behavior:

								// Check against children of newly rendered dynamic elements
								localAssetManager.mergeNode(elementSource, elementTarget);

								diff(elementSource, elementTarget);
							}
						}

						// Delete all elements that are in target but not in source (those elements after index maximum in treeSource)
						while (treeSource.children.length > treeTarget.children.length)
							treeTarget.removeChild(treeTarget.children[treeSource.children.length]);
					}

					diff(renderStreamline, renderCurrent);

					// Attach listeners through xDMS UI Interaction
					localAssetManager.syncParseInteractions(renderCurrent, xInteractions);

				} else {
					This.element.innerHTML = "";

					This.element.appendChild(renderStreamline);

					// Attach .key to elements directly
					let keyEnabledElements = This.element.querySelectorAll("[key]");
					for (let keyEnabledElement of keyEnabledElements)
						keyEnabledElement.key = keyEnabledElement.getAttribute("key");
				}

				let End = performance.now();
				console.log(`Render duration: ${End - Start}ms`);
			}

			if (!hasAlreadyRendered) {
				// It's crucial to put it here!
				hasAlreadyRendered = true;
				Events.Trigger(COMPONENT_DID_MOUNT);
			} else
				Events.Trigger(COMPONENT_DID_UPDATE);

			// TODO: Diff between last/newRenderResult
			lastRenderResult = renderStreamline;
		}

		/**
		 * The element this component will be rendered in
		 * @type {HTMLElement}
		 */
		this.element = props.element;

		/**
		 * Map with alias => component entries
		 * @type {Object<string, ViewComponent>}
		 */
		this.connectedComponents = props.connectedComponents;

		// Automatically execute componentWillUnmount
		if (!this.element.parentElement)
			throw new InvalidTypeException("props.element.parentElement");

		let Observer = new MutationObserver(function (mutationList) {
			for (const mutation of mutationList) {
				for (const el of mutation.removedNodes) {
					if (el === This.element) {
						console.log("WILL UNMOUNT");
						Observer.disconnect();
						Events.Trigger(COMPONENT_WILL_UNMOUNT);
					}
				}
			}
		});
		Observer.observe(this.element.parentElement, { childList: true });

		/**
		 * The dispatch function. Central to stores and components.
		 * @name dispatchFunction
		 * @function
		 * @param {object|function} actionFuncOrObject - If called with a function, that function will be called with dispatch as well. An object will be treated as action.
		 */

		/**
		 * Just the base props. Note that dispatch is added when the component is connected with a store
		 * @typedef {object} ViewComponentBaseProps
		 * @property {dispatchFunction} dispatch
		 */

		/**
		 * @type {ViewComponentBaseProps}
		 */
		this.props = {};

		for (let prop in props) {
			if (reservedComponentProps.indexOf(prop) === -1)
				This.props[prop] = props[prop];
		}

		/**
		 * Connect to store whenever the state changes
		 * @param {Store} store
		 */
		this.connect = function (store) {
			store.subscribe(STATE_CHANGE, this.update, null, This);
			This.componentWillUnmount(function () {
				store.unsubscribe(STATE_CHANGE, this.update);
			});

			This.store = store;
			this.props.dispatch = store.dispatch.bind(store);

			delete This.connect;
		}

		// Automatically update view whenever the state changes
		if (props.hasOwnProperty("store") && props.store instanceof Store)
			this.connect(props.store);

		/**
		 *
		 * @returns {Node|Node[]}
		 */
		this.render = this.render || function () {}

		let checkInterval = setInterval(function () {
			if (This.render.toString() !== "function () {}") {
				clearInterval(checkInterval);
				This.update();
			}
		}, 10);
	}

	/**
	 * Updates the state (does nothing if null is returned)
	 * @param {object} nextProps
	 * @param {object} prevState
	 * @returns {object|null}
	 */
	static getDerivedStateFromProps(nextProps, prevState) {
		return null;
	}
}

export default ViewComponent;