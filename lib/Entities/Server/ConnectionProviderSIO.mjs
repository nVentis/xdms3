/**
 * ConnectionProvider implemented SIO client bindings
 * @module Server/ConnectionProviderSIO
 */

import io from "socket.io-client";
import ConnectionProvider from "./ConnectionProvider.mjs";
import InvalidTypeException from "../Exceptions/InvalidTypeException.mjs";
import InvalidStateException from "../Exceptions/InvalidStateException.mjs";

var Defaults = {
	Encoding: "utf8",
	rejectUnauthorized: false // default as per Node JS 8.11.4: true; use undefined for current version's default
};

class ConnectionProviderSIO extends ConnectionProvider {
	constructor() {
		super();

		var This = this;

		This.setDefault = function (Property, Value) {
			Defaults[Property] = Value;
		}
		This.getDefault = function (Property) {
			return Defaults[Property];
		}
		This.getOptions = function () {
			return This.Options;
		}

		/*
		Options: {
			[r O] Socket: { (arguments to execute TLS.connect(~) with)
				[r S] Path OR both
				[r I] Port
				[r S] Host
			},
			[o S] Encoding,
			[]
		}
		*/

		// data communication
		// This.On = null;
		// This.Once = null;
		// This.Emit = null;
		This.End = null;

		This.Socket = null;

		This.isUsable = function () {
			return This.Socket.connected && This.Socket.authorized;
		}

		/**
		 * @typedef {object} ConnectionProviderOptions
		 * @property {ConnectionProvider} [Connection] - Manually supplied options to create a connection
		 * @property {string} [Address]
		 * @property {number} [Port]
		 */

		/**
		 * @param {ConnectionProviderOptions} Options
		 * @returns {Promise<ConnectionProviderSIO,Error>}
		 */
		This.Request = This.Connect = function (Options) {
			return new Promise(function (onSuccess, onError) {
				if (This.Started)
					throw new InvalidStateException("Connection attempt already started");
				else
					This.Options = Options;

				if (This.Options.Connection)
					var connectionOptions = This.Options.Connection;
				else
					// For available options, see https://github.com/socketio/socket.io-client/blob/master/docs/API.md#new-managerurl-options
					var connectionOptions = {
						reconnection: false,
						secure: false,
						autoConnect: true,
						timeout: 4000
					}

				if (!connectionOptions.hasOwnProperty("rejectUnauthorized"))
					connectionOptions.rejectUnauthorized = Defaults.rejectUnauthorized;

				try {
					This.Peer = Options.Address || Options.Host || This.Peer;
					This.Port = Options.Port;

					// Create Socket using options
					This.Socket = io("https://" + This.Peer + ":" + This.Port, connectionOptions);
					This.End = This.Socket.disconnect;

					This.Socket.on("connect", function () {
						This.Connected = function () { return This.Socket.connected; }
						This.connectionStarted = new Date();

						console.log("SIO Socket established");

						This.socketOn = function () { return This.Socket.on.apply(This.Socket, arguments); }
						This.socketOnce = function () { return This.Socket.once.apply(This.Socket, arguments); }
						This.socketEmit = function () { return This.Socket.emit.apply(This.Socket, arguments); }
						This.socketEnd = function () { return This.Socket.disconnect.apply(This.Socket, arguments); }
						This.socketOff = function () { return This.Socket.off.apply(This.Socket, arguments); }

						// Execute all onConnect callbacks
						This.Trigger("connectionSuccess", This);
					});

					var defaultErrorHandler = function (errorInfo) {
						// Execute all onError callbacks
						// console.log(errorInfo);
						// console.log(This.Socket.authorizationError);

						This.Trigger("connectionError", errorInfo);
						//for (var fI = 0; fI < This.socketEvents.onError.length; fI++)
						//	This.socketEvents.onError[fI].call(This, [errorInfo, This.Socket.authorizationError, This.Socket]);
					}

					This.Socket.on("error", defaultErrorHandler);
					This.Socket.on("connect_error", defaultErrorHandler);
					This.Socket.on("connect_timeout", defaultErrorHandler);

					// Attach connectionDisconnect
					if (!This.Options.onDisconnect || !(This.Options.onDisconnect instanceof Function)){
						if (This.Options.onError)
							This.Options.onDisconnect = This.Options.onError;
						else
							This.Options.onDisconnect = onError;
					}
					This.On("connectionDisconnect", This.Options.onDisconnect);

					if (This.Options.onEnd)
						This.On("connectionEnd", This.Options.onEnd);

					// Socket IO redirect to connectionEnd and connectionDisconnect events
					This.Socket.on("disconnect",
						/**
						 * @param {("io server disconnect"|"io client disconnect"|"ping timeout")} disconnectInfo
						 */
						function (disconnectInfo) {
							switch (disconnectInfo) {
								case "io server disconnect":
									This.Trigger("connectionEnd");
									break;

								default:
									This.Trigger("connectionDisconnect", disconnectInfo);
									break;
							}
						});

					// Save information
					This.Started = new Date(); // aka connectedSuccessfullyTimestamp

					// Save callbacks
					This.On("connectionSuccess", onSuccess);
					This.On("connectionError", onError);
				} catch (err) {
					console.log(err);
				}
			});
		}

		/**
		 * Attempts to use an (already connected, authenticated) Socket IO socket
		 * @param {SocketIOClient.Socket} SIOSocket
		 * @constructor
		 */
		This.Use = function (SIOSocket) {
			if (!SIOSocket)
				SIOSocket = This.Socket;

			if (!SIOSocket)
				throw new InvalidTypeException("SIOSocket");

			let Address = SIOSocket.request.headers['x-forwarded-for'] || SIOSocket.request.connection.remoteAddress,
				Port = SIOSocket.request.connection.remotePort;

			This.Socket = SIOSocket;
			This.Connected = function () {
				return This.Socket.connected;
			}
			This.End = SIOSocket.disconnect;

			This.Peer = Address;
			This.Port = Port;
		}
	}
}

export default ConnectionProviderSIO;