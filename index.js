const express = require("express");
const app = express();
const port = 4000;
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const originalDir = path.join(__dirname, 'uploads', 'original');
const optimizedDir = path.join(__dirname, 'uploads', 'optimized');
fs.mkdirSync(originalDir, { recursive: true });
fs.mkdirSync(optimizedDir, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.post("/upload", upload.single("imageInput"), async (req, res) => {
    try {
        const originalFileName = Date.now() + "_" + req.file.originalname;
        const originalPath = path.join(originalDir, originalFileName);

        fs.writeFileSync(originalPath, req.file.buffer);
        const originalUrl = `/uploads/original/${originalFileName}`;

        res.status(200).json({
            original: originalUrl,
        });
    } catch (error) {
        console.error("Error processing file:", error);
        res.status(500).json({ error: "Failed to process file" });
    }
});


app.get('/upload/:name', async (req, res) => {
    const queryString = req.query
    const originalImgName = req.params.name
    const {uri,formatedQuery} = await convertUrlString(queryString, originalImgName)
    res.sendFile(__dirname + "/uploads/optimized/" + uri, async (err) => {
        if (err) {
            if (err.status == 404) {
                if (fs.existsSync(__dirname + "/uploads/original/" + originalImgName)) {
                    let fileBuffer = await fs.readFileSync(__dirname + "/uploads/original/" + originalImgName)
                    let transformedImage = await imageTransformation(formatedQuery, fileBuffer)
                    fs.writeFileSync(__dirname + "/uploads/optimized/" + uri, transformedImage);
                    return res.sendFile(__dirname + "/uploads/optimized/" + uri)
                } else {
                    res.status(404).send({
                        "message": "File not found"
                    })
                }
            }
            else {
                res.status(500).send(err)
            }
        }
    });
})

async function convertUrlString(queryString, uri) {
    try {
        var originalImagePath = uri;
        var formatedQuery = {};
        if (queryString) {
            Object.keys(queryString).map(item => {
                switch (item.toLowerCase()) {
                    case 'format':
                        var SUPPORTED_FORMATS = ['auto', 'jpeg', 'webp', 'avif', 'png', 'svg', 'gif'];
                        if (queryString[item] && SUPPORTED_FORMATS.includes(queryString[item].toLowerCase())) {
                            var format = queryString[item].toLowerCase();
                            if (format === 'auto') {
                                format = 'jpeg';
                                if (headers['accept']) {
                                    if (headers['accept'].value.includes("avif")) {
                                        format = 'avif';
                                    } else if (headers['accept'].value.includes("webp")) {
                                        format = 'webp';
                                    }
                                }
                            }
                            formatedQuery['format'] = format;
                        }
                        break;
                    case 'width':
                        if (queryString[item]) {
                            var width = parseInt(queryString[item]);
                            if (!isNaN(width) && (width > 0)) {
                                formatedQuery['width'] = width.toString();
                            }
                        }
                        break;
                    case 'height':
                        if (queryString[item]) {
                            var height = parseInt(queryString[item]);
                            if (!isNaN(height) && (height > 0)) {
                                formatedQuery['height'] = height.toString();
                            }
                        }
                        break;
                    case 'quality':
                        if (queryString[item]) {
                            var quality = parseInt(queryString[item]);
                            if (!isNaN(quality) && (quality > 0)) {
                                if (quality > 100) quality = 100;
                                formatedQuery['quality'] = quality.toString();
                            }
                        }
                        break;
                    default: break;
                }
            });
            if (Object.keys(formatedQuery).length > 0) {
                var formatedQueryArray = [];
                if (formatedQuery.format) {
                    let extName = path.basename(originalImagePath, path.extname(originalImagePath));
                    originalImagePath = extName + '.'+formatedQuery.format
                    formatedQueryArray.push('format=' + formatedQuery.format);
                }
                if (formatedQuery.quality) formatedQueryArray.push('quality=' + formatedQuery.quality);
                if (formatedQuery.width) formatedQueryArray.push('width=' + formatedQuery.width);
                if (formatedQuery.height) formatedQueryArray.push('height=' + formatedQuery.height);
                uri = formatedQueryArray.join(',') + "_" + originalImagePath;
            } else {
                uri = originalImagePath;
            }

        } else {
            uri = originalImagePath;
        }
        return {uri,formatedQuery}

    } catch (error) {
        console.log("in url converter :", error)
    }
}

async function imageTransformation(queryOperation, fileBuffer) {
    let transformedImage = sharp(fileBuffer)
    try {
        var resizingOptions = {};
        if (queryOperation['width']) resizingOptions.width = parseInt(queryOperation['width']);
        if (queryOperation['height']) resizingOptions.height = parseInt(queryOperation['height']);
        if (resizingOptions) transformedImage = transformedImage.resize(resizingOptions);

        if (queryOperation['format']) {
            var isLossy = false;
            switch (queryOperation['format']) {
                case 'jpeg': contentType = 'image/jpeg'; isLossy = true; break;
                case 'gif': contentType = 'image/gif'; break;
                case 'webp': contentType = 'image/webp'; isLossy = true; break;
                case 'png': contentType = 'image/png'; break;
                case 'avif': contentType = 'image/avif'; isLossy = true; break;
                default: contentType = 'image/jpeg'; isLossy = true;
            }
            if (queryOperation['quality'] && isLossy) {
                transformedImage = transformedImage.toFormat(queryOperation['format'], {
                    quality: parseInt(queryOperation['quality']),
                });
            } else transformedImage = transformedImage.toFormat(queryOperation['format']);
        }
        transformedImage = await transformedImage.toBuffer();
        return transformedImage
    } catch (error) {
        throw Error('error transforming image', error);
    }
}
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
