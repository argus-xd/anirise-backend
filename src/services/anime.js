const kodikApi = require("../clients/kodik");
const cacheContainer = require("../cache-container");
const miniSearch = require("minisearch");
const rangeNumber = require("../utils/range-number");
const animeSorter = require("../utils/anime-sorter");

const searchResultsLimit = 30;
const searchEngine = new miniSearch({
  fields: ["title", "title_orig"],
  storeFields: ["shikimori_id", "title"]
});

cacheContainer.on("cache:updated", () => {
  searchEngine.removeAll();
  searchEngine.addAll(cacheContainer.animeList());
});

const search = searchTerm => {
  const result = [];
  const searchResults = searchEngine.search(searchTerm, { fuzzy: 0.2 });

  for (const searchResult of searchResults) {
    const foundAnime = cacheContainer
      .animeList()
      .find(anime => anime.shikimori_id === searchResult.shikimori_id);

    if (foundAnime) {
      result.push(foundAnime);
      if (result.length >= searchResultsLimit) {
        break;
      }
    }
  }

  return result;
};

const getAnimeList = (limit = 100, sortField, sortDirection = "desc") => {
  const correctLimit = rangeNumber(limit, 1, cacheContainer.animeList().length);
  const selectedSort = animeSorter.select(sortField, sortDirection);

  return cacheContainer
    .animeList()
    .sort(selectedSort)
    .slice(0, correctLimit);
};

const getAnimeById = async id => {
  return cacheContainer.animeList().find(anime => anime.shikimori_id === id);
};

const getAnimeByTranslatorId = async translatorId => {
  const animeList = await kodikApi.search({
    id: translatorId,
    with_episodes: true,
    with_material_data: true
  });

  if (!animeList.length) return null;

  return animeList.map(({ seasons, ...anime }) => {
    const episodes = getEpisodesFromAnime(anime, seasons);
    return {
      ...anime,
      episodes
    };
  })[0];
};

const translationsListByShikimoriId = async id => {
  const dubsList = await cacheContainer.animeListFull().filter(anime => {
    return anime.shikimori_id === id;
  });

  return dubsList.map(anime => ({
    id: anime.id,
    translator: anime.translation.title,
    type: anime.translation.type
  }));
};

const getEpisodesFromAnime = (anime, seasons) => {
  if (anime.type === "anime") {
    return [{ number: 1, link: anime.link }];
  }

  const lastSeason = anime.last_season || 1;
  const episodes = seasons[lastSeason].episodes;

  return Object.entries(episodes).map(([episode, link]) => ({
    number: Number(episode),
    link
  }));
};

const getPlaylistByEpisodeLink = link => {
  const [, type, id, hash] = link.split("/").filter(x => x);

  return kodikApi.videoPlaylist(id, type, hash);
};

module.exports = {
  search,
  getAnimeById,
  getAnimeList
};
