import { ContainerNamespace } from "./ContainerNamespace.mjs";

/**
 * The xDMS v3 Container
 * Used to access all globally registered values
 * DEPRECATED: AS OF 24.08.2020, DCI mechanism moved to Genetix RXI
 * @class
 */
export default class Container {
	constructor() {
		this.Get = function (pathArray) {
			return ContainerNamespace.Get(pathArray);
		}
	}
}