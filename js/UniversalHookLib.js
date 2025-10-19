// ==UserScript==
// @name         Universal Hook System Library
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Advanced function hooking system for Tampermonkey
// @author       Your Name
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const UniversalHook = {
        hooks: {},
        config: {
            debug: true,
            autoRestoreOnPageUnload: false
        },

        // Configure the hook system
        setConfig: function(newConfig) {
            Object.assign(this.config, newConfig);
            return this;
        },

        // Simple function hook
        hookFunction: function(functionName, callback, options = {}) {
            return this.hookFunctionAdvanced(functionName, {
                afterCall: (result, args, original) => callback(result, args, original),
                ...options
            });
        },

        // Hook constructor methods
        hookConstructor: function(constructorName, methodName, callback) {
            if (!window[constructorName]) {
                if (this.config.debug) console.log(`⏳ Waiting for constructor ${constructorName}...`);
                return this._waitForObject(constructorName).then(() => {
                    return this._hookConstructorImpl(constructorName, methodName, callback);
                });
            }
            return Promise.resolve(this._hookConstructorImpl(constructorName, methodName, callback));
        },

        _hookConstructorImpl: function(constructorName, methodName, callback) {
            const Original = window[constructorName];
            if (!Original) return false;

            const Hooked = function(...args) {
                const instance = new Original(...args);
                
                if (instance[methodName] && typeof instance[methodName] === 'function') {
                    const originalMethod = instance[methodName];
                    
                    Object.defineProperty(instance, methodName, {
                        value: function(...methodArgs) {
                            const result = originalMethod.apply(this, methodArgs);
                            return callback(result, methodArgs, originalMethod, instance);
                        },
                        writable: false,
                        configurable: false
                    });
                }

                return instance;
            };

            // Preserve prototype and properties
            Hooked.prototype = Original.prototype;
            Object.defineProperty(Hooked, 'name', { value: constructorName });
            Object.defineProperty(Hooked, 'length', { value: Original.length });

            // Copy static properties
            Object.keys(Original).forEach(key => {
                Hooked[key] = Original[key];
            });

            window[constructorName] = Hooked;
            this.hooks[constructorName] = { original: Original, method: methodName };

            if (this.config.debug) console.log(`✓ Hooked ${constructorName}.${methodName}`);
            return true;
        },

        // Hook Function constructor
        hookFunctionConstructor: function(callback) {
            const OriginalFunction = window.Function;

            const HookedFunction = function(...args) {
                if (args.length > 0) {
                    const body = args[args.length - 1];
                    const params = args.slice(0, -1);

                    const processedBody = callback(body, params, OriginalFunction);

                    if (typeof processedBody === 'string') {
                        return OriginalFunction.apply(this, [...params, processedBody]);
                    }
                }
                return OriginalFunction.apply(this, args);
            };

            HookedFunction.prototype = OriginalFunction.prototype;
            Object.defineProperty(HookedFunction, 'name', { value: 'Function' });
            Object.defineProperty(HookedFunction, 'length', { value: OriginalFunction.length });

            window.Function = HookedFunction;
            this.hooks.Function = { original: OriginalFunction, method: 'constructor' };

            if (this.config.debug) console.log('✓ Hooked Function constructor');
            return true;
        },

        // Advanced function hooking with full control
        hookFunctionAdvanced: function(functionName, options) {
            if (!window[functionName]) {
                if (this.config.debug) console.log(`⏳ Waiting for function ${functionName}...`);
                return this._waitForObject(functionName).then(() => {
                    return this._setupAdvancedHook(functionName, options);
                });
            }
            return Promise.resolve(this._setupAdvancedHook(functionName, options));
        },

        _setupAdvancedHook: function(functionName, options) {
            const original = window[functionName];
            if (typeof original !== 'function') {
                console.error(`❌ ${functionName} is not a function`);
                return false;
            }

            const hooked = (...args) => {
                // Before call hook
                let processedArgs = args;
                if (options.beforeCall) {
                    const beforeResult = options.beforeCall(args, original, this);
                    processedArgs = beforeResult !== undefined ? beforeResult : args;
                }

                let result;
                try {
                    // Call original function
                    result = original.apply(this, processedArgs);
                } catch (error) {
                    // Error handling hook
                    if (options.onError) {
                        return options.onError(error, processedArgs, original, this);
                    }
                    throw error;
                }

                // Handle async functions and promises
                if (result instanceof Promise && options.afterCall) {
                    return result.then(async (resolved) => {
                        const processed = await options.afterCall(resolved, processedArgs, original, this);
                        return processed !== undefined ? processed : resolved;
                    }).catch(error => {
                        if (options.onError) {
                            return options.onError(error, processedArgs, original, this);
                        }
                        throw error;
                    });
                }

                // Sync after call hook
                if (options.afterCall) {
                    const processed = options.afterCall(result, processedArgs, original, this);
                    return processed !== undefined ? processed : result;
                }

                return result;
            };

            // Preserve function properties
            Object.defineProperty(hooked, 'name', { value: functionName });
            Object.defineProperty(hooked, 'length', { value: original.length });

            // Copy custom properties
            Object.keys(original).forEach(key => {
                hooked[key] = original[key];
            });

            window[functionName] = hooked;
            this.hooks[functionName] = { original, options };

            if (this.config.debug) console.log(`✓ Hooked function ${functionName}`);
            return true;
        },

        // Hook object methods
        hookObjectMethod: function(objectPath, methodName, options) {
            const pathParts = objectPath.split('.');
            let current = window;
            
            for (let i = 0; i < pathParts.length - 1; i++) {
                current = current[pathParts[i]];
                if (!current) {
                    if (this.config.debug) console.log(`⏳ Waiting for object ${objectPath}...`);
                    return this._waitForObject(objectPath).then(() => {
                        return this._hookObjectMethodImpl(objectPath, methodName, options);
                    });
                }
            }
            
            return Promise.resolve(this._hookObjectMethodImpl(objectPath, methodName, options));
        },

        _hookObjectMethodImpl: function(objectPath, methodName, options) {
            const pathParts = objectPath.split('.');
            let obj = window;
            
            for (const part of pathParts) {
                obj = obj[part];
                if (!obj) {
                    console.error(`❌ Object not found: ${objectPath}`);
                    return false;
                }
            }

            const originalMethod = obj[methodName];
            if (typeof originalMethod !== 'function') {
                console.error(`❌ Method ${methodName} not found or not a function`);
                return false;
            }

            obj[methodName] = (...args) => {
                let processedArgs = args;
                if (options.beforeCall) {
                    const beforeResult = options.beforeCall(args, originalMethod, obj);
                    processedArgs = beforeResult !== undefined ? beforeResult : args;
                }

                let result;
                try {
                    result = originalMethod.apply(obj, processedArgs);
                } catch (error) {
                    if (options.onError) {
                        return options.onError(error, processedArgs, originalMethod, obj);
                    }
                    throw error;
                }

                if (result instanceof Promise && options.afterCall) {
                    return result.then(async (resolved) => {
                        const processed = await options.afterCall(resolved, processedArgs, originalMethod, obj);
                        return processed !== undefined ? processed : resolved;
                    });
                }

                if (options.afterCall) {
                    const processed = options.afterCall(result, processedArgs, originalMethod, obj);
                    return processed !== undefined ? processed : result;
                }

                return result;
            };

            const hookId = `${objectPath}.${methodName}`;
            this.hooks[hookId] = { original: originalMethod, object: obj, methodName };
            
            if (this.config.debug) console.log(`✓ Hooked ${hookId}`);
            return true;
        },

        // Utility method to wait for objects/functions to be defined
        _waitForObject: function(path, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const pathParts = path.split('.');
                let elapsed = 0;
                const interval = 100;

                const check = () => {
                    let obj = window;
                    for (const part of pathParts) {
                        obj = obj[part];
                        if (!obj) break;
                    }

                    if (obj) {
                        resolve(obj);
                    } else if (elapsed >= timeout) {
                        reject(new Error(`Timeout waiting for ${path}`));
                    } else {
                        elapsed += interval;
                        setTimeout(check, interval);
                    }
                };

                check();
            });
        },

        // Restore original function
        restore: function(name) {
            if (this.hooks[name]) {
                const hook = this.hooks[name];
                
                if (hook.object) {
                    // Object method hook
                    hook.object[hook.methodName] = hook.original;
                } else {
                    // Global function/constructor hook
                    window[name] = hook.original;
                }
                
                delete this.hooks[name];
                if (this.config.debug) console.log(`✗ Restored ${name}`);
                return true;
            }
            return false;
        },

        // Restore all hooks
        restoreAll: function() {
            Object.keys(this.hooks).forEach(name => this.restore(name));
            return this;
        },

        // Get hook information
        getHookInfo: function(name) {
            return this.hooks[name] || null;
        },

        // List all active hooks
        listHooks: function() {
            return Object.keys(this.hooks);
        }
    };

    // Auto-restore on page unload if configured
    if (UniversalHook.config.autoRestoreOnPageUnload) {
        window.addEventListener('beforeunload', () => {
            UniversalHook.restoreAll();
        });
    }

    // Make available globally
    window.UniversalHook = UniversalHook;
    
    if (UniversalHook.config.debug) {
        console.log('🚀 Universal Hook System ready');
    }
})();
