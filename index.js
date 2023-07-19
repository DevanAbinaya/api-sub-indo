const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const baseUrl = "https://samehadaku.skin";

const app = express();

app.get("/", (req, res) => {
  res.send({
    message: "Welcome to Samehadaku API",
    route: ["/search/:query?p={page}", "/anime/:id", "/source/:id"],
  });
});

app.get("/search/:query", async (req, res) => {
  try {
    const query = req.params.query;
    const page = req.query.p;

    if (!query) {
      return res.status(200).json({
        intro: "Welcome to search route",
        usage: [
          "To search for an anime, use the 'q' query parameter",
          "To specify the page number, use the 'p' query parameter",
        ],
      });
    }

    const url = `${baseUrl}/page/${page || 1}/?s=${query}`;

    const { data } = await axios.get(url);

    const $ = cheerio.load(data);

    const searchResults = {
      page: "1",
      results: [],
    };

    const firstSpanElement = $(".pagination span").first();

    // Get the text content of the first span element, which contains "Page 1 of 21"
    const pageText = firstSpanElement.text();

    if (pageText) {
      searchResults.page = pageText;
    }

    // Select all <a> tags within the 'relat' div
    const results = $(".site-main a")
      .map((index, element) => {
        // Extract the href link and title attributes from each <a> tag
        const url = $(element).attr("href");
        const title = $(element).attr("title");

        const modifiedUrl = url.replace("https://samehadaku.skin/anime/", "");
        const lastSlashIndex = modifiedUrl.lastIndexOf("/");
        const finalResult = modifiedUrl.substring(0, lastSlashIndex);

        const imageSrc = $(element).find("img.anmsa").attr("src");

        if (title) {
          searchResults.results.push({
            id: finalResult,
            title,
            image: imageSrc,
          });
          return { url, finalResult, imageSrc };
        }
      })
      .get(); // Convert Cheerio object to a regular array

    if (results.length > 0) {
      res.status(200).json(searchResults);
    } else {
      res.json({ message: "No results found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

app.get("/anime/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const url = `${baseUrl}/anime/${id}`;
    const { data } = await axios.get(url);

    const $ = cheerio.load(data);

    const anime = {
      id,
      title: "",
      image: "",
      synopsis: "",
      episodes: [],
    };

    const titleElement = $(".infox h1");

    const title = titleElement.text();

    if (title) {
      anime.title = title;
    }

    const imageElement = $(".thumb img");

    const imageSrc = imageElement.attr("src");

    if (imageSrc) {
      anime.image = imageSrc;
    }

    const episodeList = $(".lstepsiode li")
      .map((index, element) => {
        const number = $(element).find(".eps a").text();
        const episodeId = $(element).find(".eps a").attr("href");
        const title = $(element).find(".lchx a").text();
        const date = $(element).find(".date").text();

        const modifiedEpisodeId = episodeId.replace(
          "https://samehadaku.skin/",
          ""
        );

        const lastSlashIndex = modifiedEpisodeId.lastIndexOf("/");
        const finalResult = modifiedEpisodeId.substring(0, lastSlashIndex);

        return { number, id: finalResult, title, date };
      })
      .get();

    if (episodeList.length > 0) {
      anime.episodes = episodeList;
    }

    res.status(200).json(anime);
  } catch (error) {
    res.status(404).json({ message: "Anime not found" });
  }
});

app.get("/source/:id", async (req, res) => {
  const id = req.params.id;

  async function fetchAndParse(url) {
    try {
      const response = await axios.get(url);
      return cheerio.load(response.data);
    } catch (error) {
      console.error(`Error fetching ${url}: ${error}`);
      return null;
    }
  }

  // The URL of the website containing the quality links
  const url = `${baseUrl}/$${id}/`; // Replace with the actual URL

  // Parse the HTML content with Cheerio
  const { data } = await axios.get(url);

  const $ = cheerio.load(data);

  const qualityData = [];

  $("ul li").each((index, element) => {
    const quality = $(element).find("strong").text().trim();

    const links = $(element)
      .find("span a")
      .filter((_, a) => $(a).text().trim() === "Krakenfiles")
      .map((_, a) => $(a).attr("href"))
      .get();

    if (quality && links) {
      qualityData.push({ quality, links });
    }
  });

  let videoSrc = [];

  for (const qualityDataItem of qualityData) {
    for (const link of qualityDataItem.links) {
      const $inner = await fetchAndParse(link);
      if ($inner) {
        const playVideoParentElement = $inner("div.play-video-parent");

        const sourceElement = playVideoParentElement.find("source");

        const sourceURL = sourceElement.attr("src");

        console.log(`Quality: ${qualityDataItem.quality}`);
        console.log(`Source URL: ${sourceURL}`);
        if (sourceURL && sourceURL.includes(".mp4")) {
          videoSrc.push({
            quality: qualityDataItem.quality,
            url: `https:${sourceURL}`,
          });
        }
      }
    }
  }

  if (videoSrc.length > 0) {
    res.status(200).send(videoSrc);
  } else {
    res.status(404).send({ error: "No video source found" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
