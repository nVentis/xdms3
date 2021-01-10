/**
 * @module Client/UI/AssetManager
 * See class
 */


import NotImplementedException from "../../Exceptions/NotImplementedException.mjs";

/**
 * A class for managing CSS, JS and HTML assets with optional caching using simpleStorageProvider (now: GenericStorage implementations)
 * @class
 */
class AssetManager {
	constructor() {
		var This = this;

		this.Defaults = {
			Storage: null,
			Timeout: 5000,
			autoSave: true // automatically save all received resources, except if they have the .Live property set to true or Options was called with property Live set to true
		};

		this.Types = {};
		this.Protocols = {};

		/** @type {Object.<string, (xDMS.Providers.dataStorage.simpleStorageProviderAsync|xDMS.Providers.dataStorage.simpleStorageProviderSync)>} */
		this.Storages = {};
		this.Converters = {};

		// TODO: Implement cache with Resource.Name => Resource
		/** @type {Object.<string, xDMS.UIX.Providers.assetManager.Resource>} */
		this.Cache = {};

		/**
		 * @typedef {object} loadCacheOptions
		 * @property {string[]} [Storages] - By default, only assets from the default storage will be loaded. If supplied, only assets of these storages will be loaded. Assuming storage names
		 * @property {boolean} [Overwrite=false] - By default, new resources with an existing name will not be restored to cache, but skipped
		 */

		/**
		 * @description Loads all resources of the default storage or any specified storages to this.Cache, readily available for sync access
		 * @param {loadCacheOptions} Options
		 * @returns {Promise<boolean>}
		 */
		this.loadCache = function (Options) {
			if (typeof Options !== "object")
				Options = {};

			if (!Options.Storages)
				Options.Storages = [This.Defaults.Storage];

			if (typeof Options.Overwrite === "undefined")
				Options.Overwrite = false;

			return new Promise(function (onSuccess, onError) {
				let perStorage = function (storageName) {
					return new Promise(function (onActionSuccess, onActionError) {
						/** @type {(xDMS.Providers.dataStorage.simpleStorageProviderAsync|xDMS.Providers.dataStorage.simpleStorageProviderSync)} */
						let Storage = This.Storages[storageName];
						if (!Storage instanceof xDMS.Provider ||
							!Storage.Meta.Type.startsWith("simpleStorageProvider"))
							return onActionError(new Error("Invalid storage supplied"));

						if (Storage instanceof xDMS.iProvider) {
							let Keys = Storage.Keys();
							Keys.forEach(function (storageKey) {
								let resourceSerialized = Storage.Request(storageKey);
								if (!This.Cache[resourceSerialized.Name] || Options.Overwrite) {
									let Resource = new This.Ressource(
										resourceSerialized.Name,
										resourceSerialized.Reference
									);
									Resource.Content = resourceSerialized.Content;
									Resource.Type = resourceSerialized.Type;

									This.Cache[resourceSerialized.Name] = Resource;
								}
							});
							return onActionSuccess();
						} else {
							// TODO: Implement the same asynchronously for xDMS.dProvider
						}
					});
				};

				return xDMS.Async.onceFirst(Options.Storages, perStorage).then(onSuccess, onError);
			});
		};

		this.addType = function (xDataType) {
			// xDataType = Instance of xDMS.dataType
			This.Types[xDataType.Name.toUpperCase()] = xDataType;

			return This;
		};
		this.addProtocol = function (assetSourceProtocol) {
			// assetSourceProtocol = Instance of GP.assetSourceProtocol
			This.Protocols[assetSourceProtocol.Handles] = assetSourceProtocol;

			return This;
		};

		/**
		 * @description Assign this assetManager a storage that can be used to cache loaded resources, especially for commonly used resources
		 * @param Name
		 * @param {(xDMS.Providers.dataStorage.simpleStorageProviderSync|xDMS.Providers.dataStorage.simpleStorageProviderAsync)} simpleStorageProvider
		 * @returns {*}
		 */
		this.addStorage = function (Name, simpleStorageProvider) {
			This.Storages[Name] = simpleStorageProvider;

			if (!This.Defaults.Storage)
				This.setDefaultStorageByName(Name);

			return This;
		};

		this.addConverter = function (Input, Output, Converter) {
			// Maybe remove these checks?
			/*if (!(Converter instanceof Function))
				return new Error("Invalid converter function added!");

			Input = (Input && Input.toUpperCase) ? Input.toUpperCase() : null;
			Output = (Output && Output.toUpperCase) ? Output.toUpperCase() : null;

			if (!Input || !Output)
				return new Error("Invalid converter attached!");*/

			Input = Input.toUpperCase();
			Output = Output.toUpperCase();

			this.Converters[Input + "->" + Output] = Converter;

			return This;
		}

		this.setDefaultStorageByName = function (Name) {
			This.Defaults.Storage = Name;
		};
		this.setDefaultStorage = function (Name) {
			this.Defaults.Storage = Name;
		};

		/**
		 * @namespace xDMS.UIX.Providers.assetManager.Resource
		 * @description Returns a resource using a (unique) name, custom reference and options
		 * @param Name
		 * @param Reference
		 * @param Options
		 * @constructor
		 */
		this.Ressource = function (Name, Reference, Options) {
			/// <summary>
			///		Constructor for Ressources such as images loaded over an URL or map tiles loaded from a database
			/// </summary>
			/// <param name="Name" type="String"></param>
			/// <param name="Type" type="xDMS.dataType"></param>
			/// <param name="Reference" type="Any"></param>

			if (!Options)
				Options = {}

			var Ressource = this;

			this.Name = Name;

			this.Protocol = Reference.slice(0, Reference.indexOf(":")).toUpperCase();
			this.Source = Reference.slice(Reference.indexOf(":") + 1);
			this.Reference = this.Protocol + ":" + this.Source; // this is for upperCasing the Protocol

			this.Type = Options.hasOwnProperty("Type") ? Options.Type : null;
			this.Live = Options.hasOwnProperty("Live") ? Options.Live : false;
			// Live specifies if the Ressource is *additionally* tried to be retrieved from connected storages (false) or *only* by invoking it's protocol (true)

			this.Content = null; // Will be set by Request, if possible
			this.Convert = function (Output) {
				return new Promise(function (onSuccess, onError) {
					var converterName = (Ressource.Type && Ressource.Type.toUpperCase && Output && Output.toUpperCase) ? Ressource.Type.toUpperCase() + "->" + Output.toUpperCase() : null;
					if (!converterName || !This.Converters[converterName])
						return onError(new Error("Invalid Type given"));

					// Allow both synchronous and asynchronous converters
					var Conversion = This.Converters[converterName](Ressource);

					if (xDMS.Async.isThenable(Conversion))
						return Conversion.then(onSuccess, onError);
					else
						return onSuccess(Conversion);
				});
			}
			this.syncConvert = function (Output) {
				var converterName = (Ressource.Type && Ressource.Type.toUpperCase && Output && Output.toUpperCase) ? Ressource.Type.toUpperCase() + "->" + Output.toUpperCase() : null;
				if (!converterName || !This.Converters[converterName])
					return new Error("Invalid Type given");

				return This.Converters[converterName](Ressource);
			};

			this.Clone = function () {
				var Clone = new This.Ressource(Name, Reference, Options);

				Clone.Content = Ressource.Content;
				Clone.Type = Ressource.Type;
				Clone.Live = Ressource.Live;

				return Clone;
			};

			this.Serialize = function () {
				var Serialized = {
					Name: Ressource.Name,
					Reference: Ressource.Reference,
					Content: Ressource.Content,
					Type: Ressource.Type
				};

				return Serialized;
			};

			this.Store = function (Storage, Options) {
				return This.Store(this, Storage, Options);
			};

			this.Request = function (Options) {
				return This.Request(this, Options);
			};

			return this;
		};

		/**
		 *
		 * @param {HTMLElement} treeSource
		 */
		this.cloneTreeSync = function (treeSource) {
			// TODO: Consider alternative using recursive .cloneNode()
			return treeSource.cloneNode(true);
		}

		let skippedAttributesDuringMerge = ["class", "style", "type"];

		/**
		 * Merges nodeSource into nodeTarget
		 * @param {HTMLElement} nodeSource
		 * @param {HTMLElement} nodeTarget
		 * @param {boolean} [Options.Recursive=false]
		 * @returns {HTMLElement}
		 */
		this.mergeNode = function (
			nodeSource,
			nodeTarget,
			Options = {}
		) {
			// Throw an exception if the structure does not fit
			if (!nodeSource || !nodeTarget || nodeSource.nodeType !== nodeTarget.nodeType)
				throw new Error("nodeSource");

			// Different merging for different element types
			switch (nodeSource.nodeType) {
				case Node.TEXT_NODE:
					nodeTarget.textContent = nodeSource.textContent;
					break;

				case Node.ELEMENT_NODE:
					if (nodeTarget.hasAttribute("static"))
						return;

					// Merge styles
					let stylesSource = nodeSource.style,
						stylesTarget = nodeTarget.style;

					// Get a full list of applies styles
					let appliedStyles = [];

					for (let propertyIndex = 0; propertyIndex < stylesSource.length; propertyIndex++) {
						let propertyName = stylesSource.item(propertyIndex);
						if (!appliedStyles.includes(propertyName))
							appliedStyles.push(propertyName);
					}

					for (let propertyIndex = 0; propertyIndex < stylesTarget.length; propertyIndex++) {
						let propertyName = stylesTarget.item(propertyIndex);
						if (!appliedStyles.includes(propertyName))
							appliedStyles.push(propertyName);
					}

					// Remove styles that are on the target but not on source and add styles missing on the target
					for (let propertyName of appliedStyles) {
						if (stylesTarget.getPropertyValue(propertyName) !== stylesSource.getPropertyValue(propertyName)) {
							//console.log(nodeSource, nodeTarget, propertyName, stylesSource, stylesTarget, stylesTarget[propertyName], stylesSource[propertyName]);
							stylesTarget.setProperty(propertyName, stylesSource.getPropertyValue(propertyName));
						}
					}

					// Merge classes
					let classesSource = [...nodeSource.classList],
						classesTarget = [...nodeTarget.classList];

					for (let classTarget of classesTarget) {
						if (!classesSource.includes(classTarget)) // remove undesired classes
							nodeTarget.classList.remove(classTarget);
					}

					for (let classSource of classesSource) {
						if (!classesTarget.includes(classSource))
							nodeTarget.classList.add(classSource);
					}


					// Merge attributes

					/**
					 * Attribute names
					 * @type {string[]}
					 */
					let attrSourceNames = nodeSource.getAttributeNames(),
						attrTargetNames = nodeTarget.getAttributeNames();

					/**
					 * Mappings of attribute name => value
					 * @type {object<string,string>}
					 */
					let attrSource = {},
						attrTarget = {};

					for (let attrSourceName of attrSourceNames) {
						if (!skippedAttributesDuringMerge.includes(attrSourceName))
							attrSource[attrSourceName] = nodeSource.getAttribute(attrSourceName);
					}

					for (let attrTargetName of attrTargetNames) {
						if (!skippedAttributesDuringMerge.includes(attrTargetName)) {
							if (attrSource[attrTargetName]) {
								attrTarget[attrTargetName] = nodeSource.getAttribute(attrTargetName);
							} else {
								// remove attribute if it's not with the source
								nodeTarget.removeAttribute(attrTargetName);
								console.log(nodeTarget);
							}
						}
					}

					for (let attrName in attrSource) // add / edit attribute where needed
						if (attrTarget[attrName] !== attrSource[attrName])
							nodeTarget.setAttribute(attrName, attrSource[attrName]);

					// Merge value
					if (nodeSource.tagName === "INPUT") {
						if (nodeSource.value !== nodeTarget.value)
							nodeTarget.value = nodeSource.value;

						if (nodeSource.checked !== nodeTarget.checked)
							nodeTarget.checked = nodeSource.checked;


					} else if (nodeSource.tagName === "SELECT") {
						// If a value was assigned to a select tag, automatically apply it to the displayed (target) element
						let value = nodeSource.getAttribute("value");

						if (value !== null)
							nodeTarget.value = value;
					}

					if (Options.Recursive === true && nodeSource.children.length) {
						// Assumes same structure accross source & target
						for (let childIndex = 0; childIndex < nodeSource.children.length; childIndex++) {
							This.mergeNode(nodeSource.children[childIndex], nodeTarget.children[childIndex], {
								Recursive: true
							});
						}
					}
					break;

				default:
					throw new NotImplementedException(`Merging elements of nodeType ${nodeSource.nodeType}`);
			}

			return nodeTarget;
		}

		/**
		 * Merges two 2 DOMTrees: Respects existing items in treeTarget and will only apply required data from treeSource
		 * Assumes the two trees already have the same DOM structure (i.e., same children etc.). Will throw an exception
		 * if otherwise
		 * @param {HTMLElement} treeSource
		 * @param {HTMLElement} treeTarget
		 * @param {object} [Options]
		 */
		this.mergeTreesSync = function (
			treeSource,
			treeTarget,
			Options = {}
		) {
			This.mergeNode(treeSource, treeTarget, {
				Recursive: true
			});

			return treeTarget;
		}

		/**
		 * @typedef {object} xInteractionEntry
		 * @property {string} Type - Start, Trigger, Move, Stop
		 * @property {function} Callback
		 * @property {*} This - Allows setting this for the called function
		 * @property {*} Arguments - Allows setting arguments. Interpreted as an array (!); otherwise converted to one
		 * @property {*} Identifier - Allows setting a unique property in order to avoid registering the same listener again. Preferably, Symbol() is used
		 */

		/**
		 * Parses a HTMLParent element and attempts to replace nodes with respective xRessources
		 * @param {Element} HTMLParent
		 * @param {object<string,xInteractionEntry>|function} xInteractions - If a function is supplied, it's interpreted as Callback
		 * @param {object} [Options={}]
		 * @param {object<string,object>} [Options.Resources] - Defaults to This.Cache
		 * @param {string} [Options.xResSelector="xres"]
		 * @returns {HTMLElement}
		 */
		this.syncParse = function (
			HTMLParent,
			xInteractions,
			Options = {}
		) {
			if (!Options.xResSelector)
				Options.xResSelector = "xres";

			let xRessources = Options.Resources || This.Cache;

			if (HTMLParent instanceof HTMLElement) {
				var xRessourceElements = HTMLParent.querySelectorAll(Options.xResSelector),
					xRessourcesMax = Object.keys(xRessourceElements).length;

				var mergeElement = function (xResElement, newElement) {
						// Merge xResAttrData
						var xResElementClasses = (xResElement.className.length ? (xResElement.className.indexOf(" ") === -1 ? [xResElement.className] : xResElement.className.split(" ")) : []),
							$newElement = $(newElement);

						// 1. Classes
						while (xResElementClasses.length)
							$newElement.addClass(xResElementClasses.pop());

						// 2. ID
						if (xResElement.id)
							newElement.id = xResElement.id;

						// Replace element
						xResElement.parentElement.replaceChild(newElement, xResElement);
					},
					parseElement = function (xResElement, xResName) {
						if (xRessources.hasOwnProperty(xResName)) {
							var xRessource = xRessources[xResName],
								xResParentElement = xResElement.parentElement;

							if (xRessource.Type === "HTMLElement")
								mergeElement(xResElement, xRessource.Content);
							else {
								var xRessourceAsHTML = xRessource.syncConvert("HTMLElement");

								mergeElement(xResElement, xRessourceAsHTML);
							}
						}
					}

				for (var xRessourceIndex = 0; xRessourceIndex < xRessourcesMax; xRessourceIndex++) {
					var xResElement = xRessourceElements[xRessourceIndex],
						xResName = xResElement.getAttribute("name");

					parseElement(xResElement, xResName);
				}

				if (xInteractions)
					This.syncParseInteractions(HTMLParent, xInteractions);

				return HTMLParent;
			} else
				return new Error("Invalid HTMLContent for assetManager.Parse()");
		};

		this.Parse = function (HTMLParent, xInteractions) {
			let xRessources = This.Cache;

			// HTMLParent is either a (non-parsed) HTML string OR a HTMLElement
			return new Promise(function (onSuccess, onError) {
				if (HTMLParent instanceof HTMLElement) {
					var xRessourceElements = HTMLParent.querySelectorAll("xres"),
						xRessourcesMax = Object.keys(xRessourceElements).length,
						promiseArray = [];

					var mergeElement = function (xResElement, newElement) {
							// Merge xResAttrData
							var xResElementClasses = (xResElement.className.length ? (xResElement.className.indexOf(" ") === -1 ? [xResElement.className] : xResElement.className.split(" ")) : []),
								$newElement = $(newElement);

							// 1. Classes
							while (xResElementClasses.length)
								$newElement.addClass(xResElementClasses.pop());

							// 2. ID
							if (xResElement.id)
								newElement.id = xResElement.id;

							// Replace element
							xResElement.parentElement.replaceChild(newElement, xResElement);
						},
						parseElement = function (xResElement, xResName) {
							if (xRessources.hasOwnProperty(xResName)) {
								var xRessource = xRessources[xResName],
									xResParentElement = xResElement.parentElement;

								if (xRessource.Type === "HTMLElement")
									mergeElement(xResElement, xRessource.Content);
								else
									promiseArray.push(new Promise(function (onConvertSuccess, onConvertError) {
										xRessource.Convert("HTMLElement").then(function (xRessourceAsHTML) {
											mergeElement(xResElement, xRessourceAsHTML);
											onConvertSuccess();
										}, onConvertError);
									}));
							}
						}

					for (var xRessourceIndex = 0; xRessourceIndex < xRessourcesMax; xRessourceIndex++) {
						var xResElement = xRessourceElements[xRessourceIndex],
							xResName = xResElement.getAttribute("name");

						parseElement(xResElement, xResName);
					}

					xDMS.Async.Once(promiseArray).then(function () {
						This.syncParseInteractions(HTMLParent, xInteractions);
						return onSuccess();
					}, onError);
				} else
					return onError(new Error("Invalid HTMLContent for assetManager.Parse()"));
			});
		}

		/**
		 * Supports parsing interactions "xinteractionstart" and "xinteractioncontextmenu"
		 * @param {HTMLElement} HTMLParent
		 * @param {object<string, function>} xInteractions - A map of interaction name to interaction handler
		 */
		this.syncParseInteractions = function (HTMLParent, xInteractions) {
			// TODO: Also parse other interactions than just "start"
			let xInteractionElements = HTMLParent.querySelectorAll("[xinteractionstart]");
			xInteractionElements.forEach(function (cElement) {
				let cAction = cElement.getAttribute("xinteractionstart");

				if (!xInteractions[cAction])
					return;

				if (typeof xInteractions[cAction] === "function")
					xInteractions[cAction] = {
						Callback: xInteractions[cAction]
					}

				let cArg = cElement.hasAttribute("xinteractionargument") ? cElement.getAttribute("xinteractionargument") : null,
					cThis = (typeof xInteractions[cAction].This !== "undefined") ? xInteractions[cAction].This : cArg;

				let cActionFunction = (cThis || xInteractions[cAction].Arguments) ? (function (evt) {
					let argArray = [evt].concat(cArg, xInteractions[cAction].Arguments);

					xInteractions[cAction].Callback.apply(cThis, argArray);
				}) : xInteractions[cAction].Callback;

				// For per-element identifier
				if (!cElement._interactionIdentifier)
					cElement._interactionIdentifier = Symbol();

				xDMS.UI.Interaction.Register(
					cElement,
					xInteractions[cAction].Type || "Start",
					cActionFunction,
					false,
					cElement._interactionIdentifier
				);
			});

			let xInteractionContextMenuElements = HTMLParent.querySelectorAll("[xinteractioncontextmenu]");
			xInteractionContextMenuElements.forEach(function (cElement) {
				let cAction = cElement.getAttribute("xinteractioncontextmenu");

				if (!xInteractions[cAction])
					return;

				if (typeof xInteractions[cAction] === "function")
					xInteractions[cAction] = {
						Callback: xInteractions[cAction]
					}

				let cArg = cElement.hasAttribute("xinteractionargument") ? cElement.getAttribute("xinteractionargument") : null,
					cThis = (typeof xInteractions[cAction].This !== "undefined") ? xInteractions[cAction].This : cArg;

				let cActionFunction = (cThis || xInteractions[cAction].Arguments) ? (function (evt) {
					let argArray = [evt].concat(cArg, xInteractions[cAction].Arguments);

					xInteractions[cAction].Callback.apply(cThis, argArray);
				}) : xInteractions[cAction].Callback;

				// For per-element identifier
				if (!cElement._interactionIdentifier)
					cElement._interactionIdentifier = Symbol();

				xDMS.UI.Interaction.onContextMenu(
					cElement,
					{
						onContextMenu: cActionFunction
					}
				);
			});
		};

		/**
		 * @description Find the first storage that contains the desired resource and return it
		 * @param {xDMS.UIX.Providers.assetManager.Resource} Resource
		 * @param {object} Options
		 */
		this.checkStoragesSync = function (Resource, Options) {
			// Find first sync storage containing the item

			let storageFound = null,
				cStorage;

			for (let cStorageName in This.Storages) {
				cStorage = This.Storages[cStorageName];
				if (cStorage.isAsyncProvider)
					continue;

				if (cStorage.Exist(Resource.Reference)) {
					storageFound = true;
					break;
				}
			}

			if (!storageFound)
				return null;
			else {
				// De-serialize object: Recreate Resource() instance from values
				// TODO: Maybe refresh whole resource from storage, not only loading content
				var resourceObjectSerialized = cStorage.Request(Resource.Reference);
				Resource.Content = resourceObjectSerialized.Content;
				Resource.Type = resourceObjectSerialized.Type;

				return Resource;
			}
		};

		/**
		 * @description Find the first async storage that contains the desired resource and request it
		 * @param {xDMS.UIX.Providers.assetManager.Resource} Resource
		 * @param {object} Options
		 * @returns {Promise<xDMS.UIX.Providers.assetManager.Resource>}
		 */
		this.checkStoragesAsync = function (Resource, Options) {
			return new Promise(function (onSuccess, onError) {
				if (!Options)
					Options = {};

				var checkSuccessful = false,
					nStoragesAvailable = 0,
					nStoragesChecked = 0,
					errorOccured = false,
					onActionCompleted = function (Result) {
						// TODO: What about type preservation?
						if (nStoragesChecked === nStoragesAvailable) {
							if (errorOccured)
								return onError(errorOccured);
							else {
								Resource.Content = Result;
								return onSuccess(Resource);
							}
						}
					};

				for (var Name in This.Storages) {
					// Use checkStoragesSync first, this method itself will mainly check for async storages and invoke checkStoragesSync
					if (!This.Storages[Name].isAsyncProvider)
						continue;

					nStoragesAvailable++;

					This.Storages[Name].Request(Resource.Reference).then(function (Result) {
						nStoragesChecked++;
						checkSuccessful = true;

						onActionCompleted(Result);
					}, function (errorInfo) {
						nStoragesChecked++;
						errorOccured = errorInfo;

						onActionCompleted();
					});
				}

				if (!nStoragesAvailable)
					return onSuccess(null);

				// Timeout implementation
				var checkTimeout = setTimeout(function () {
					if (!checkSuccessful)
						return onError(new Error("Timeout occured while executing checkStoragesAsync"));
				}, Options.Timeout || This.Defaults.Timeout);
			});
		};
		this.checkStorages = async function (Resource, Options) {
			// Check sync storages first
			var syncResult = This.checkStoragesSync(Resource, Options);
			if (syncResult !== null)
				return syncResult;

			var asyncResult = await This.checkStoragesAsync(Resource, Options);
			if (asyncResult !== null)
				return asyncResult;

			return null;
		};
		this.checkProtocol = function (Resource, Options) {
			return new Promise(function (onSuccess, onError) {
				if (!Options)
					Options = {};

				// Timeout implementation
				var checkSuccessful = false,
					checkTimeout = setTimeout(function () {
						if (!checkSuccessful)
							return onError(new Error("Timeout occured while executing checkProtocol"));
					}, Options.Timeout || This.Defaults.Timeout);

				if (This.Protocols[Resource.Protocol]) {
					This.Protocols[Resource.Protocol].Request(Resource).then(function (Result) {
						checkSuccessful = true;

						Resource.Content = Result;

						// Auto-save if requested
						if (This.Defaults.autoSave && This.Defaults.Storage) {
							let defStorage = This.Storages[This.Defaults.Storage];
							if (defStorage.isAsyncProvider) {
								return defStorage.Store(Resource.Reference, Resource.Serialize()).then(function () {
									return onSuccess(Resource);
								}, onError);
							} else {
								defStorage.Store(Resource.Reference, Resource);
								return onSuccess(Resource);
							}
						} else
							return onSuccess(Resource);
					}, onError);
				} else
					return onError(new Error("Protocol [" + Resource.Protocol + "] unknown"));
			});
		};

		this.Request = function (Ressource, Options) {
			return new Promise(function (onSuccess, onError) {
				if (!Options)
					Options = {};

				// [!TBD!]: Type checking if content is available
				if (Ressource.Content && !(Ressource.Live === true || Options.Live === true) && Ressource.isValid) {
					return onSuccess(Ressource);
				} else {
					// We are forced to load the Ressource using the given Protocol if either Live = true or no Storages are registered
					if (Ressource.Live === true || Options.Live === true || !Object.keys(This.Storages).length) {
						This.checkProtocol(Ressource, Options).then(onSuccess, onError);
					} else {
						// Iterate through Storages to check if the Ressource has already been saved before
						This.checkStorages(Ressource, Options).then(function (resourceResult) {
							if (resourceResult !== null)
								return onSuccess(resourceResult);
							else
								return This.checkProtocol(Ressource, Options).then(onSuccess, function (errorInfo) {
									return onError(errorInfo);
								});
						}, onError);
					}
				}
			});
		}

		this.Store = function (Ressource, Options) {
			return new Promise(function (onSuccess, onError) {
				if (!Options)
					Options = {}

				Storage = Options.Storage || This.Defaults.Storage;

				if (!This.Storages[Storage])
					return onError(new Error("Specified simpleStorageProvider [" + Storage + "] is unknown"));

				if (!Ressource.Content && !Options.Live)
					return onError(new Error("Specified Resource does not allow to fetch any content as of yet to be saved"));
				else if (Options.Live)
					Ressource.Request({
						Live: true
					}).then(storeAction, onError);
				else
					storeAction();

				var storeAction = function () {
					This.Storages[Storage].Store(Ressource.Reference, Ressource.Content).then(onSuccess, onError);
				}
			});
		}
	}
}

export default AssetManager;