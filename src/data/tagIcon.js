// @ts-check
/**
 * data/tagIcon.js — pure helper for picking which tag's custom FontAwesome icon (if any) should
 * render before a question's text (render/nodeViews/questionView.js's qTagIcon). Kept in data/*
 * (not features/tags.js, where the rest of tag CRUD lives) so render/* can call it directly without
 * importing features/* — see CLAUDE.md's render -> features one-way dependency rule.
 * @typedef {{icon?: string}} TagMeta
 */

/**
 * Always the FIRST tag in the question's own tag order (q.tags[0]) — whether it's the only tag or
 * one of several, that tag's icon (if it has one) is what shows; every other tag's icon is ignored.
 * No "primary" concept: which tag wins is purely "first added to this question", so there's never
 * a conflict to resolve. Returns null when there are no tags or the first one has no icon set.
 * @param {string[]} qTags
 * @param {Record<string, TagMeta>} tagMeta
 * @returns {string|null}
 */
export function pickDisplayTagIcon(qTags, tagMeta) {
  if (!qTags || qTags.length === 0) return null;
  return tagMeta[qTags[0]]?.icon || null;
}
