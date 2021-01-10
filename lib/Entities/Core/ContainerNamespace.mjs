import ProtectedNamespace from "./ProtectedNamespace.mjs";

var ContainerNamespace = new ProtectedNamespace(),
	ContainerNamespaceConfig = new Map();

ContainerNamespaceConfig.set("rootDir", "../../../../");

export {
	ContainerNamespace,
	ContainerNamespaceConfig
}