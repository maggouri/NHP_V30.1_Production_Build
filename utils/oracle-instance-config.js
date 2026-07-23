/**
 * Oracle VM instance profile — overwritten per copy by prepare-oracle-extension-instances.sh.
 * Desktop / single-instance installs keep profile null (all operations allowed).
 */
(function (global) {
    'use strict';

    global.NHP_ORACLE_INSTANCE = Object.freeze({
        profile: null,
        cdpPort: null,
        label: 'NHP Desktop',
        roles: Object.freeze(['all']),
        multiInstance: false
    });
    global.NHP_ORACLE_INSTANCE_PROFILE = null;
})(typeof globalThis !== 'undefined' ? globalThis : self);
