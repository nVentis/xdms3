/**
 *
 * @module Server/ConnectionProvider
 */
import {EventNamespace} from "../Event/Namespace.mjs";
import NotImplementedException from "../Exceptions/NotImplementedException.mjs";

/**
 * Address, Port and rejectUnauthorized will only be used if there is no socket already registered.
 * An onSuccess listener is automatically added (e.g. the promise resolve function) and executed when
 * the connection is established.
 *
 * @typedef {object} ConnectionProviderOptions
 * @property {string} Address
 * @property {number|string} Port
 * @property {boolean} rejectUnauthorized
 * @property {function} [onDisconnect=onError] - Executed whenever a disconnects occurs
 * @property {function} [onEnd] - Executed whenever the connection is closed by the remote partner
 * @property {function} onError - Executed whenever a connection error occurs
 * @property {function} onData - Executed whenever data is available. With ()
 *
 */

/**
 *
 * @class
 */
class ConnectionProvider extends EventNamespace {
	constructor() {
		super();

		var This = this;

		This.setDefault = function (Property, Value) {
			throw new NotImplementedException("setDefault");
		}
		This.getDefault = function (Property) {
			throw new NotImplementedException("getDefault");
		}
		This.getOptions = function () {
			throw new NotImplementedException("getOptions");
		}
		This.Options = {}; // set with onConnect()

		/**
		 * @type {string}
		 */
		This.Peer = null;

		/**
		 * @type {string}
		 */
		This.Port = null;

		This.Socket = null;

		/**
		 * Function returning a flag whether the socket is currently connected or not. Preferably directly references a value of the socket object
		 * @property {function}
		 */
		This.Connected = function () { return false; };

		/**
		 * Timestamp when socket has been created
		 * @property {Date|null} [This.Started=0]
		 */
		This.Started = null;

		/**
		 * Timestamp when the connection has been established succesfully
		 * @type {Date|null}
		 */
		This.connectionStarted = null;

		/**
		 * Destroys any connection(s) currently bound to this ConnectionProvider
		 */
		This.End = function () {
			return new NotImplementedException("End");
		}

		This.isUsable = function () {
			return new NotImplementedException("isUsable");
		}

		This.Request = This.Connect = function () {
			return new NotImplementedException("Connect");
		}
	}
}

export default ConnectionProvider;