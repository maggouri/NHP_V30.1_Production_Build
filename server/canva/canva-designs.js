'use strict';

const crypto = require('crypto');
const { getCanvaConfig, getCanvaDesignDimensions } = require('./canva-config');
const { getValidAccessToken } = require('./canva-oauth');
const { canvaApiRequest } = require('./canva-assets');

function buildCanvaEditUrl(designId) {
    return `https://www.canva.com/design/${encodeURIComponent(designId)}/edit`;
}

function buildCreateDesignBody(assetId, title, width, height) {
    return {
        asset_id: assetId,
        title: title || 'NHP HuntPro Design',
        design_type: {
            type: 'custom',
            width,
            height
        }
    };
}

function buildBlankDesignBody(title, width, height) {
    return {
        title: title || `NHP Blank ${width}×${height}`,
        design_type: {
            type: 'custom',
            width,
            height
        }
    };
}

async function createDesignFromAsset(rootDir, assetId, { title, log = () => {} } = {}) {
    const cfg = getCanvaConfig(rootDir);
    const { width, height } = getCanvaDesignDimensions(rootDir);
    const baseTitle = title || 'NHP HuntPro Design';
    if (cfg.mockMode) {
        const designId = `mock_design_${crypto.randomBytes(6).toString('hex')}`;
        const editUrl = buildCanvaEditUrl(designId);
        const mockTitle = `${baseTitle} (${width}×${height})`;
        log(`Canva mock create design from asset ${assetId} → ${designId} [${width}×${height}]`, 'INFO');
        return {
            designId,
            editUrl,
            mockMode: true,
            title: mockTitle,
            width,
            height,
            designType: { type: 'custom', width, height }
        };
    }
    const token = await getValidAccessToken(rootDir, log);
    const body = buildCreateDesignBody(assetId, baseTitle, width, height);
    const data = await canvaApiRequest(rootDir, token, 'POST', '/designs', body, log);
    const designId = data?.design?.id || data?.id;
    if (!designId) throw new Error('Canva create design did not return design id');
    const editUrl = data?.design?.urls?.edit_url || data?.urls?.edit_url || buildCanvaEditUrl(designId);
    log(`Canva design created: ${designId} (${width}×${height})`, 'INFO');
    return {
        designId,
        editUrl,
        mockMode: false,
        title: baseTitle,
        width,
        height,
        designType: body.design_type
    };
}

async function createBlankDesign(rootDir, { title, width, height, log = () => {} } = {}) {
    const cfg = getCanvaConfig(rootDir);
    const dims = (width && height)
        ? { width: Number(width), height: Number(height) }
        : getCanvaDesignDimensions(rootDir);
    const w = dims.width;
    const h = dims.height;
    const baseTitle = title || `NHP Blank ${w}×${h}`;
    if (cfg.mockMode) {
        const designId = `mock_blank_${crypto.randomBytes(6).toString('hex')}`;
        const editUrl = buildCanvaEditUrl(designId);
        log(`Canva mock create blank design → ${designId} [${w}×${h}]`, 'INFO');
        return {
            designId,
            editUrl,
            mockMode: true,
            blank: true,
            title: baseTitle,
            width: w,
            height: h,
            designType: { type: 'custom', width: w, height: h }
        };
    }
    const token = await getValidAccessToken(rootDir, log);
    const body = buildBlankDesignBody(baseTitle, w, h);
    const data = await canvaApiRequest(rootDir, token, 'POST', '/designs', body, log);
    const designId = data?.design?.id || data?.id;
    if (!designId) throw new Error('Canva create blank design did not return design id');
    const editUrl = data?.design?.urls?.edit_url || data?.urls?.edit_url || buildCanvaEditUrl(designId);
    log(`Canva blank design created: ${designId} (${w}×${h})`, 'INFO');
    return {
        designId,
        editUrl,
        mockMode: false,
        blank: true,
        title: baseTitle,
        width: w,
        height: h,
        designType: body.design_type
    };
}

async function openDesign(rootDir, designId, { log = () => {} } = {}) {
    const cfg = getCanvaConfig(rootDir);
    if (cfg.mockMode) {
        const editUrl = buildCanvaEditUrl(designId || `mock_design_${crypto.randomBytes(4).toString('hex')}`);
        log(`Canva mock open design: ${designId}`, 'INFO');
        return { designId: designId || editUrl.split('/').slice(-2, -1)[0], editUrl, mockMode: true };
    }
    const token = await getValidAccessToken(rootDir, log);
    const data = await canvaApiRequest(rootDir, token, 'GET', `/designs/${encodeURIComponent(designId)}`, null, log);
    const editUrl = data?.design?.urls?.edit_url || data?.urls?.edit_url || buildCanvaEditUrl(designId);
    log(`Canva design opened: ${designId}`, 'INFO');
    return { designId, editUrl, mockMode: false };
}

module.exports = {
    buildCanvaEditUrl,
    buildCreateDesignBody,
    buildBlankDesignBody,
    createDesignFromAsset,
    createBlankDesign,
    openDesign
};
