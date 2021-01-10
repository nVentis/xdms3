/**
 * @module Entities/Event/Namespace
 */
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";

class EventListenerEntry {
	/**
	 *
	 * @param {string} Event
	 * @param {function} Callback
	 * @param {boolean} [Once=false]
	 * @param {EventNamespace} evtNamespace
	 */
	constructor(Event, Callback, Once, thisArgument, evtNamespace) {
		if (typeof Callback !== "function")
			throw new InvalidTypeException("Callback");

		this.UID = Symbol(Event); // check this for uniqueness

		// Also, attach UID to callback function for reference purposes
		Callback._UID = this.UID;

		this.Once = Once || false;
		this.Callback = Callback;

		this.Remove = function () {
			var Listeners = evtNamespace.Listeners[Event];
			if (Listeners) {
				for (var Index = 0; Index < Listeners.length; Index++) {
					if (Listeners[Index].UID === this.UID) {
						// splice ALWAYS WITH INDEX, DUMBASS
						Listeners.splice(Index, 1);
						break;
					}
				}

				if (evtNamespace.Listeners[Event].length === 0)
					delete evtNamespace.Listeners[Event];
			}
		}
		this.Trigger = function (Arguments, This) {
			return evtNamespace.Trigger(Event, Arguments, This);
		}
		this.thisArgument = thisArgument || {};
	}
}

class EventNamespace {
	constructor() {
		var evtNamespace = this;

		/**
		 * Checks if the supplied argument can be treated as promise
		 * @param something
		 * @returns {boolean}
		 */
		let isThenable = function (something){
			return (
				something &&
				something.then &&
				something.resolve &&
				typeof something.then === "function" &&
				typeof something.resolve === "function"
			);
		}

		/**
		 * Holds references to all listeners
		 * @type {Object.<string,EventListenerEntry[]>}
		 */
		this.Listeners = {

		};

		/**
		 * An entry is created for every listener
		 * @class
		 */
		this.ListenerEntry = class extends EventListenerEntry {
			/**
			 *
			 * @param {string} Event
			 * @param {function} Callback
			 * @param {boolean} [Once=false]
			 * @param {*} thisArgument
			 */
			constructor(Event, Callback, Once, thisArgument) {
				super(Event, Callback, Once, thisArgument, evtNamespace);
			}
		}

		/**
		 * Attaches an event listener which will be fired upon every .fire() call matching the exact event name
		 * @param {string} Event
		 * @param {function} Callback
		 * @param {object} [thisArgument={}]
		 * @returns {ListenerEntry}
		 */
		this.On = function (Event, Callback, thisArgument) {
			return evtNamespace.Register(Event, Callback, false, thisArgument);
		};

		/**
		 * Same as .On(), but attached listeners will be removed after being executed once
		 * @param {string} Event
		 * @param {function} Callback
		 * @param {object} [thisArgument]
		 * @returns {ListenerEntry}
		 */
		this.Once = function (Event, Callback, thisArgument) {
			return evtNamespace.Register(Event, Callback, true, thisArgument);
		};

		/**
		 * Removes a given listener from an event
		 * @param {string} Event
		 * @param {function} Callback
		 * @returns {number} How many ListenerEnty entities were removed
		 */
		this.Off = function (Event, Callback) {
			let eventEntries = this.Listeners[Event];
			if (!eventEntries || !eventEntries.length)
				return;

			let lastFound = 0,
				nRemoved = 0;

			while (lastFound < eventEntries.length) {
				if (eventEntries[lastFound].UID === Callback.UID) {
					eventEntries.splice(lastFound, 1);
					nRemoved++;
				} else
					lastFound++;
			}

			return nRemoved;
		}

		/**
		 * Checks Condition() whenever the Event is fired (only until first successful check if checkUntilSuccessful is set true).
		 * Will only fire Callback if Condition returns true
		 * @param {string} Event
		 * @param {function} Callback
		 * @param {boolean} checkUntilSuccessful - Controls if the listener will be removed after the first check has been successful
		 * @param {function} Condition - A function to be called on every event invocation with the event data as argument
		 * @param {object} [thisArgument=null]
		 * @returns {ListenerEntry}
		 */
		this.When = function (
			Event,
			Callback,
			checkUntilSuccessful,
			Condition,
			thisArgument = null
		) {
			var eventEntry = evtNamespace.Register(Event, function () {
				var Arguments = arguments;

				return new Promise(function (onFinish) {
					var condResult = Condition.apply(eventEntry.This || null, Arguments);
					if (condResult === true) {
						if (checkUntilSuccessful === true)
							eventEntry.Remove();

						var eventExecution = Callback.apply(eventEntry.This || null, Arguments);
						if (isThenable(eventExecution))
							eventExecution.then(onFinish);
						else
							return onFinish(eventExecution);
					} else // [!TBC!]: REVAMP REQUIRED?!
						return onFinish();
				});
			}, false, thisArgument);

			return eventEntry;
		};

		/**
		 * Generic event register function
		 * @param {string} Event
		 * @param {function} Callback
		 * @param {boolean} [Once=false]
		 * @param {object} [thisArgument]
		 * @returns {ListenerEntry}
		 * @constructor
		 */
		this.Register = function (Event, Callback, Once, thisArgument) {
			if (Callback && Callback instanceof Array) {
				var Result = [];
				for (var fIndex = 0; fIndex < Callback.length; fIndex++)
					Result.push(evtNamespace.Register(Event, Callback[fIndex], Once, thisArgument));

				return Result;
			}

			var listenerEntry = new evtNamespace.ListenerEntry(Event, Callback, Once);

			/*
			var eventEntry = {
				UID: Symbol(Event), // check this for uniqueness
				Once: Once || false,
				Callback: Callback,
				Remove: function () {
					var Listeners = evtNamespace.Listeners[Event];
					if (Listeners) {
						for (var Index = 0; Index < Listeners.length; Index++) {
							if (Listeners[Index].UID === eventEntry.UID) {
								// splice ALWAYS WITH INDEX, DUMBASS
								Listeners.splice(Index, 1);
								break;
							}
						}

						if (evtNamespace.Listeners[Event].length === 0)
							delete evtNamespace.Listeners[Event];
					}
				},
				Trigger: function (Arguments, This) {
					return evtNamespace.Trigger(Event, Arguments, This);
				},
				This: thisArgument || {}
			};*/

			if (!(evtNamespace.Listeners[Event] instanceof Array))
				evtNamespace.Listeners[Event] = [listenerEntry];
			else
				evtNamespace.Listeners[Event].push(listenerEntry);

			return listenerEntry;
		};

		/**
		 * @description Trigger a previously defined Event while invoking optional arguments
		 * @param {string} Event Name of the Event
		 * @param {*} [Arguments] - Automatically converted to array. If it is intended to just pass an array, make sure to wrap that array in another array.
		 * @returns {Array} - Callback results
		 */
		this.Trigger = function (Event, Arguments) {
			if (typeof Arguments === "undefined" || !(Arguments instanceof Array))
				Arguments = [Arguments];

			if (evtNamespace.Listeners[Event]) {
				/**
				 * @type {EventListenerEntry[]}
				 */
				var Listeners = evtNamespace.Listeners[Event];

				return Listeners.map(function (Listener) {
					let Result = Listener.Callback.apply(Listener.thisArgument || null, Arguments);

					if (Listener.Once === true)
						Listener.Remove();

					return Result;
				})

				/*
				while (lastIndex < Listeners.length) {
					var eventEntry = Listeners[lastIndex];

					eventEntry.Callback.apply(eventEntry.This || null, Arguments);
					if (eventEntry.Once === true)
						eventEntry.Remove();

					lastIndex++;
				}*/
			}

			return [];
		};

		/**
		 * @description As .Trigger(), but returns a Promise that is executed after all potential async actions have run
		 * @param {string} Event
		 * @param {*|*[]} Arguments - Arguments / Automatically converted to array. If it is intended to just pass an array, make sure to wrap that array in another array.
		 * @returns {Promise<[],Error>}
		 */
		this.Then = function (Event, Arguments) {
			return new Promise(function (onSuccess, onError) {
				if (!(Arguments instanceof Array))
					Arguments = [Arguments];

				if (evtNamespace.Listeners[Event]) {
					var Listeners = evtNamespace.Listeners[Event],
						promiseArray = [];

					for (var Index = 0; Index < Listeners.length; Index++) {
						var eventEntry = Listeners[Index],
							eventExecution = eventEntry.Callback.apply(eventEntry.This || null, Arguments);

						if (isThenable(eventExecution))
							promiseArray.push(eventExecution);

						if (eventEntry.Once)
							eventEntry.Remove();
					}

					if (!promiseArray.length)
						return onSuccess();
					else
						return Promise.all(promiseArray).then(onSuccess, onError);
				} else
					return onSuccess(null);
			});
		};
	}
}

class EventNamespaceArray extends Array {
	constructor() {
		super();
		//EventNamespace.prototype.
		EventNamespace.prototype.constructor.apply(this);
	}
}

export {
	EventNamespace,
	EventNamespaceArray
};