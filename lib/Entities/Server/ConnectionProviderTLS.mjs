/**
 *
 * @module Server/ConnectionProviderTLS
 */

import ConnectionProvider from "./ConnectionProvider.mjs";
import * as TLS from 'tls';
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException.mjs";

let Defaults = {
	Encoding: "utf8",
	rejectUnauthorized: false // default as per Node JS 8.11.4: true; use undefined for current version's default
}

/**
 * Base of HPS connections. Using TLS sockets to conform the ConnectionProvider spec
 * @class
 */
class ConnectionProviderTLS extends ConnectionProvider {
	/**
	 *
	 * @param {TLS.TLSSocket|null} Socket
	 */
	constructor(Socket = null) {
		super(Socket);

		let This = this;

		This.setDefault = function (Property, Value) {
			Defaults[Property] = Value;
		}
		This.getDefault = function (Property) {
			return Defaults[Property];
		}
		This.getOptions = function () {
			return This.Options;
		}

		This.Peer = null;
		This.Port = null;

		// data communication
		// [!TBD!]: NOT YET IMPLEMENTED: Requires using Socket.write() and Socket.on("data") on the respective sides
		//This.On = null;
		//This.Once = null;
		//This.Emit = null;

		This.Socket = Socket;

		This.isUsable = function () {
			return This.Socket &&
				(This.Socket.readable || This.Socket.writable) &&
				This.Socket.encrypted &&
				This.Socket.readyState === "open";
		}

		/**
		 * @param {ConnectionProviderOptions} Options
		 * @type {function(*): Promise<ConnectionProviderTLS,Error>}
		 */
		This.Request = This.Connect = function (Options) {
			return new Promise(function (onSuccess, onError) {
				if (This.Connected())
					throw new InvalidStateException("Connection attempt already started");
				else
					This.Options = Options;

				This.Peer = Options.Address || Options.Host || This.Peer;
				This.Port = Options.Port;

				// Create Socket using options
				if (!This.Socket)
					This.Socket = TLS.connect({
						host: This.Peer,
						port: This.Port,
						rejectUnauthorized: (Options.hasOwnProperty("rejectUnauthorized") ? Options.rejectUnauthorized : Defaults.rejectUnauthorized)
					});

				if (typeof This.Options.Timeout === "number") {
					setTimeout(function () {
						if (!This.connectionStarted)
							This.Socket.destroy("Connection request timed out");
					}, This.Options.Timeout);
				}

				// Attach connectionDisconnect
				if (!This.Options.onDisconnect || !(This.Options.onDisconnect instanceof Function)){
					if (This.Options.onError)
						This.Options.onDisconnect = This.Options.onError;
					else
						This.Options.onDisconnect = onError;
				}
				This.On("connectionDisconnect", This.Options.onDisconnect);

				// Attach redirection events to this EventNamespace
				This.attachListeners(false);

				// Save information
				This.Started = new Date();
				This.Socket.setEncoding(Options.Encoding || Defaults.Encoding);

				if (onSuccess instanceof Function)
					This.On("connectionSuccess", onSuccess);

				if (onError instanceof Function)
					This.On("connectionError", onError);
			});
		}

		/**
		 * Attempts to attach the redirection events directly to the TLS socket
		 * @param {boolean} [alreadyAuthenticated=false]
		 */
		This.attachListeners = function (alreadyAuthenticated = false) {
			This.Socket.on("end", function (hadError) {
				if (hadError)
					This.Trigger("connectionDisconnect");
				else
					This.Trigger("connectionEnd");
			});

			This.Socket.on("error", function (errorInfo) {
				// Execute all onError callbacks
				// console.log(This.Socket.authorizationError);
				// console.log(This.Socket.getPeerCertificate(true));

				switch (errorInfo.code) {
					case "ECONNRESET":
						This.Trigger("connectionDisconnect", errorInfo);
						break;

					default:
						This.Trigger("connectionError", errorInfo);
						break;
				}
			});

			if (!alreadyAuthenticated)
				This.Socket.on("secureConnect", function () {
					This.Connected = function () { return This.Socket.readable; }
					This.connectionStarted = new Date(); // aka connectedSuccessfullyTimestamp

					This.End = This.Socket.end;

					// console.log("TLS Socket established");

					// Execute all onConnect callbacks
					This.Trigger("connectionSuccess", This);
				});
		}

		/**
		 * Attempts to use an (already connected, authenticated) TLS socket
		 * @param {TLS.TLSSocket} TLSSocket
		 * @param {boolean} alreadyAuthenticated
		 */
		This.Use = function (TLSSocket, alreadyAuthenticated = false) {
			if (!TLSSocket)
				TLSSocket = This.Socket;
			else
				This.Socket = TLSSocket;

			if (!TLSSocket)
				throw new InvalidTypeException("TLSSocket");

			This.attachListeners(alreadyAuthenticated);

			This.Connected = function () { TLSSocket.readable; }
			if (This.Connected() && !This.connectionStarted)
				This.connectionStarted = new Date();

			This.Peer = TLSSocket.remoteAddress;
			This.Port = TLSSocket.remotePort;
		}
	}
}

export default ConnectionProviderTLS;