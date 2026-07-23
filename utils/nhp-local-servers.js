/**
 * NHP local server registry — shared by background (importScripts) and UI pages.
 */
(function (global) {
    'use strict';

    const CLI_PROXY_PORT = 8317;
    const CLI_PROXY_LOCAL_BASE = `http://127.0.0.1:${CLI_PROXY_PORT}/v1`;

    const NHP_LOCAL_SERVERS = Object.freeze([
        { id: 'teepublic-ghost', label: 'TeePublic Ghost', port: 3019, type: 'ghost', startScript: 'addon\\servers\\teepublic_ghost_3019\\NHP_Start_TeePublic_Ghost_SilentCore.bat', stopScript: 'addon\\servers\\teepublic_ghost_3019\\NHP_Stop_TeePublic_Ghost_SilentCore.bat' },
        { id: 'creaty-signup', label: 'Creaty Signup', port: 3020, type: 'node', startScript: 'addon\\servers\\creaty_signup_3020\\NHP_Start_Creaty_Signup_SilentCore.bat', stopScript: 'addon\\servers\\creaty_signup_3020\\NHP_Stop_Creaty_Signup_SilentCore.bat' },
        { id: 'redbubble-ghost', label: 'Redbubble Ghost', port: 3021, type: 'ghost', startScript: 'addon\\servers\\redbubble_ghost_3021\\NHP_Start_Redbubble_Ghost_SilentCore.bat', stopScript: 'addon\\servers\\redbubble_ghost_3021\\NHP_Stop_Redbubble_Ghost_SilentCore.bat' },
        { id: 'amazon-ghost', label: 'Amazon Ghost', port: 3022, type: 'ghost', startScript: 'addon\\servers\\amazon_ghost_3022\\NHP_Start_Amazon_Ghost_SilentCore.bat', stopScript: 'addon\\servers\\amazon_ghost_3022\\NHP_Stop_Amazon_Ghost_SilentCore.bat' },
        { id: 'pinterest-ghost', label: 'Pinterest Ghost', port: 3023, type: 'node', startScript: 'addon\\servers\\pinterest_ghost_3023\\NHP_Start_Pinterest_Ghost_SilentCore.bat', stopScript: 'addon\\servers\\pinterest_ghost_3023\\NHP_Stop_Pinterest_Ghost_SilentCore.bat' },
        { id: 'creaty-workflow', label: 'Creaty Workflow Ghost', port: 3024, type: 'ghost', startScript: 'addon\\servers\\creaty_workflow_3024\\NHP_Start_Creaty_Workflow_Ghost_SilentCore.bat', stopScript: 'addon\\servers\\creaty_workflow_3024\\NHP_Stop_Creaty_Workflow_Ghost_SilentCore.bat' },
        { id: 'ai-bridge', label: 'AI Bridge', port: 3031, type: 'bridge', startScript: 'addon\\servers\\ai_bridge_3031\\NHP_Start_AI_Bridge_SilentCore.bat', stopScript: 'addon\\servers\\ai_bridge_3031\\NHP_Stop_AI_Bridge_SilentCore.bat' },
        { id: 'cliproxy-local', label: 'CLIProxyAPI Local', port: CLI_PROXY_PORT, type: 'cliproxy', baseUrl: CLI_PROXY_LOCAL_BASE, startScript: 'addon\\servers\\cliproxy_8317\\NHP_Start_CLIProxyAPI_Local_SilentCore.bat', stopScript: 'addon\\servers\\cliproxy_8317\\NHP_Stop_CLIProxyAPI_Local_SilentCore.bat' }
    ]);

    const BULK_SCRIPTS = Object.freeze({
        startAll: 'addon\\01_Start_All\\NHP_Start_All_Servers_SilentCore.bat',
        stopAll: 'addon\\02_Stop_All\\NHP_Stop_All_Servers_SilentCore.bat',
        restartAll: 'addon\\03_Restart_All\\NHP_Restart_All_Servers_SilentCore.bat'
    });

    const DISABLED_STORAGE_KEY = 'nhpLocalServersDisabled';

    function getServerById(serverId) {
        return NHP_LOCAL_SERVERS.find((item) => item.id === String(serverId || '').trim()) || null;
    }

    function joinProjectPath(projectDir, relativePath) {
        const root = String(projectDir || '').replace(/[/\\]+$/, '');
        const rel = String(relativePath || '').replace(/^[/\\]+/, '').replace(/\//g, '\\');
        return root ? `${root}\\${rel}` : rel;
    }

    global.NhpLocalServers = Object.freeze({
        CLI_PROXY_PORT,
        CLI_PROXY_LOCAL_BASE,
        NHP_LOCAL_SERVERS,
        BULK_SCRIPTS,
        DISABLED_STORAGE_KEY,
        getServerById,
        joinProjectPath
    });
})(typeof globalThis !== 'undefined' ? globalThis : self);
