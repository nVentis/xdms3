/**
 * See class
 * @module Client/UI/ReactableInterface
 */

import ViewComponent from "./ViewComponent.mjs";

const RESERVED_PROPS = {
    key: true,
    ref: true,
    __self: true,
    __source: true,
};

/**
 *
 * @param {string|ViewComponent|HTMLElement} type
 * @param {object} props
 * @param {array|HTMLCollection} children
 */
function createElement(type, config = {}, children) {
    let propName;

    // Reserved names are extracted
    const props = {};

    let key = null;
    let ref = null;
    let self = null;
    let source = null;

    if (config != null) {
        if (config.ref)
            ref = config.ref;

        if (config.key)
            key = '' + config.key;

        self = config.__self === undefined ? null : config.__self;
        source = config.__source === undefined ? null : config.__source;

        // Remaining properties are added to a new props object
        for (propName in config) {
            if (
                hasOwnProperty.call(config, propName) && !RESERVED_PROPS.hasOwnProperty(propName)
            ) {
                props[propName] = config[propName];
            }
        }
    }

    // Children can be more than one argument, and those are transferred onto
    // the newly allocated props object.
    const childrenLength = arguments.length - 2;
    if (childrenLength === 1) {
        props.children = children;
    } else if (childrenLength > 1) {
        const childArray = Array(childrenLength);
        for (let i = 0; i < childrenLength; i++) {
            childArray[i] = arguments[i + 2];
        }
        if (__DEV__) {
            if (Object.freeze) {
                Object.freeze(childArray);
            }
        }
        props.children = childArray;
    }

    // Resolve default props
    if (type && type.defaultProps) {
        const defaultProps = type.defaultProps;
        for (propName in defaultProps) {
            if (props[propName] === undefined) {
                props[propName] = defaultProps[propName];
            }
        }
    }

    return ReactElement(
        type,
        key,
        ref,
        self,
        source,
        ReactCurrentOwner.current,
        props,
    );
}

export {
    createElement
}