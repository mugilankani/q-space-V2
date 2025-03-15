import { getYouTubeSummary } from "./ai";

function getMimeType(imageUrl) {
  if (imageUrl.endsWith(".png")) return "image/png";
  if (imageUrl.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function downloadImage(imageUrl) {
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const filename = `${Date.now()}-${path.basename(new URL(imageUrl).pathname)}`;
  const tempImagePath = path.join(tempDir, filename);
  await fs.writeFile(tempImagePath, response.data);
  const mimeType = getMimeType(imageUrl);
  return { tempImagePath, mimeType };
}

async function processImages(mdContent) {
  const imageRegex = /!\[.*?\]\((https?:\/\/.*?)\)/g;
  const imageMatches = [...mdContent.matchAll(imageRegex)];
  const imagesArray = [];

  for (const match of imageMatches) {
    const [fullMatch, imageUrl] = match;
    console.log("Found image URL:", imageUrl);
    try {
      const { tempImagePath, mimeType } = await downloadImage(imageUrl);
      imagesArray.push({ fullMatch, tempImagePath, mimeType });
    } catch (err) {
      console.error("Error downloading image:", imageUrl, err);
    }
  }

  for (const img of imagesArray) {
    console.time(`Image Processing: ${img.tempImagePath}`);
    const caption = await getGeminiCaption(img.tempImagePath, img.mimeType);
    console.timeEnd(`Image Processing: ${img.tempImagePath}`);
    mdContent = mdContent.replace(img.fullMatch, `image to text: ${caption}`);
    await fs
      .unlink(img.tempImagePath)
      .catch((err) => console.error("Error deleting image:", err));
  }
  return mdContent;
}

async function processYouTubeLinks(mdContent) {
  const youtubeRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  for (const match of [...mdContent.matchAll(youtubeRegex)]) {
    const fullMatch = match[0];
    console.time(`YouTube Processing: ${fullMatch}`);
    const summary = await getYouTubeSummary(fullMatch);
    console.timeEnd(`YouTube Processing: ${fullMatch}`);
    mdContent = mdContent.replace(fullMatch, `Video TextBook: ${summary}`);
  }
  return mdContent;
}

async function processCustomYouTube(mdContent) {
  const customYoutubeRegex =
    /<Youtube\s+videoId=['"]([^'"]+)['"](?:\s+start=['"]([^'"]+)['"])?(?:\s+end=['"]([^'"]+)['"])?.*?\/>/g;
  for (const match of [...mdContent.matchAll(customYoutubeRegex)]) {
    const [fullMatch, videoId, startTime, endTime] = match;
    console.time(`Custom YouTube Processing: ${videoId}`);
    const transcript = await getYouTubeCaptions(videoId, startTime, endTime);
    const summary = await generateVideoSummary(
      videoId,
      transcript,
      startTime,
      endTime,
    );
    console.timeEnd(`Custom YouTube Processing: ${videoId}`);
    mdContent = mdContent.replace(
      fullMatch,
      `Video summary (${startTime || "start"} to ${endTime || "end"}): ${summary}`,
    );
  }
  return mdContent;
}
