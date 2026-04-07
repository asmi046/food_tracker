const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { randomUUID } = require('crypto');

function createImageStorage(uploadsDir) {
    const originalsDir = path.join(uploadsDir, 'original');
    const compressedDir = path.join(uploadsDir, 'compressed');
    const imagesIndexPath = path.join(uploadsDir, 'images-index.json');

    async function ensureStorage() {
        await fs.mkdir(originalsDir, { recursive: true });
        await fs.mkdir(compressedDir, { recursive: true });

        try {
            await fs.access(imagesIndexPath);
        } catch {
            await fs.writeFile(imagesIndexPath, '[]\n', 'utf8');
        }
    }

    function getImageAttachment(message) {
        const attachments = message?.body?.attachments || [];
        return attachments.find((item) => item?.type === 'image' && item?.payload?.url) || null;
    }

    async function appendImageIndex(record) {
        const raw = await fs.readFile(imagesIndexPath, 'utf8');
        const data = JSON.parse(raw);
        data.push(record);
        await fs.writeFile(imagesIndexPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    }

    async function downloadBuffer(url, accessToken) {
        const res = await fetch(url);
        if (res.ok) {
            return Buffer.from(await res.arrayBuffer());
        }

        if (!accessToken) {
            throw new Error(`Failed to download image: HTTP ${res.status}`);
        }

        const authRes = await fetch(url, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!authRes.ok) {
            throw new Error(`Failed to download image with token: HTTP ${authRes.status}`);
        }

        return Buffer.from(await authRes.arrayBuffer());
    }

    async function processImageAttachment({ attachment, chatId, messageId }) {
        const id = randomUUID();
        const sourceUrl = attachment.payload.url;
        const sourceToken = attachment.payload.token;
        const originalBuffer = await downloadBuffer(sourceUrl, sourceToken);

        const originalPath = path.join(originalsDir, `${id}.bin`);
        const compressedPath = path.join(compressedDir, `${id}.jpg`);

        await fs.writeFile(originalPath, originalBuffer);

        await sharp(originalBuffer)
            .rotate()
            .resize({ width: 1280, withoutEnlargement: true })
            .jpeg({ quality: 75, mozjpeg: true })
            .toFile(compressedPath);

        const originalStat = await fs.stat(originalPath);
        const compressedStat = await fs.stat(compressedPath);

        const record = {
            id,
            chatId,
            messageId,
            sourceUrl,
            originalPath,
            compressedPath,
            originalBytes: originalStat.size,
            compressedBytes: compressedStat.size,
            savedAt: new Date().toISOString(),
        };

        await appendImageIndex(record);

        return {
            id,
            originalBytes: originalStat.size,
            compressedBytes: compressedStat.size,
            originalPath,
            compressedPath,
        };
    }

    return {
        ensureStorage,
        getImageAttachment,
        processImageAttachment,
    };
}

module.exports = {
    createImageStorage,
};
