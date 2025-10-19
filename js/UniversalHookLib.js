// ==UserScript==
// @name         My Hooking Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Example script using Universal Hook System
// @author       You
// @match        *://*/*
// @run-at       document-start
// @require      https://your-domain.com/universal-hook-system.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Wait for the hook system to be ready
    if (typeof UniversalHook === 'undefined') {
        console.error('Universal Hook System not loaded!');
        return;
    }

    // Configure the hook system
    UniversalHook.setConfig({
        debug: true,
        autoRestoreOnPageUnload: true
    });

    // Example 1: Simple function hook
    UniversalHook.hookFunction('alert', (result, args, original) => {
        console.log('Alert called with:', args);
        return result; // You can modify the return value
    });

    // Example 2: Advanced hook with before/after callbacks
    UniversalHook.hookFunctionAdvanced('fetch', {
        beforeCall: (args, original) => {
            console.log('Fetch called with URL:', args[0]);
            // You can modify arguments
            return args;
        },
        afterCall: (result, args, original) => {
            console.log('Fetch completed');
            return result;
        },
        onError: (error, args, original) => {
            console.error('Fetch failed:', error);
        }
    });

    // Example 3: Hook constructor method
    UniversalHook.hookConstructor('XMLHttpRequest', 'open', (result, args, original, instance) => {
        console.log('XHR open called:', args);
        return result;
    });

    // Example 4: Hook object method
    UniversalHook.hookObjectMethod('console', 'log', {
        beforeCall: (args, original, obj) => {
            args[0] = `[Hooked] ${args[0]}`;
            return args;
        }
    });

    // Example 5: Hook Function constructor
    UniversalHook.hookFunctionConstructor((body, params, original) => {
        console.log('Function created with body:', body);
        return body; // You can modify the function body
    });
})();