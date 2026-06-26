#!/usr/bin/env node
import assert from "node:assert/strict";
import { findMatchesFromRows } from "./h1_local_notion_fallback.mjs";

const pageId = "38b97749-c608-8165-88f3-cc093ed31850";
const transcriptionId = "38b97749-c608-81e9-a2d9-fb367995ce3a";
const summaryRootId = "38b97749-c608-8013-90f9-d3544f940fab";
const transcriptRootId = "38b97749-c608-80ff-9cd2-fb2c0c6c278e";

const rows = [
  {
    id: pageId,
    type: "page",
    parent_id: "2a297749-c608-80c9-b666-000b2ce5e923",
    properties: JSON.stringify({
      title: [
        ["SX MTG 三浦工業 "],
        ["‣", [["b"], ["d", { type: "datetime", time_zone: "Asia/Tokyo", start_date: "2026-06-26", start_time: "11:00" }]]],
      ],
    }),
    content: JSON.stringify([transcriptionId]),
    created_time: 1782439149562,
    last_edited_time: 1782441994226,
    alive: 1,
  },
  {
    id: transcriptionId,
    type: "transcription",
    parent_id: pageId,
    properties: JSON.stringify({ title: [["SX MTG 三浦工業"]] }),
    content: JSON.stringify([summaryRootId, transcriptRootId]),
    alive: 1,
  },
  {
    id: summaryRootId,
    type: "text",
    parent_id: transcriptionId,
    properties: null,
    content: JSON.stringify([
      "38b97749-c608-816b-91c2-c8d3df3406f4",
      "38b97749-c608-8170-ab6d-e33ce712fbfd",
      "38b97749-c608-814a-a6c1-e60fde927b98",
      "38b97749-c608-817f-b560-c6382b6a3f5f",
    ]),
    alive: 1,
  },
  {
    id: "38b97749-c608-816b-91c2-c8d3df3406f4",
    type: "sub_sub_header",
    parent_id: summaryRootId,
    properties: JSON.stringify({ title: [["アクションアイテム"]] }),
    content: null,
    alive: 1,
  },
  {
    id: "38b97749-c608-8170-ab6d-e33ce712fbfd",
    type: "to_do",
    parent_id: summaryRootId,
    properties: JSON.stringify({ title: [["石原が大木との座組み・役割分担を整理し、参加者に共有する"]], checked: [["No"]] }),
    content: null,
    alive: 1,
  },
  {
    id: "38b97749-c608-814a-a6c1-e60fde927b98",
    type: "to_do",
    parent_id: summaryRootId,
    properties: JSON.stringify({ title: [["NDA締結後、排液サンプル500mlから1Lの提供について具体的に進める"]], checked: [["No"]] }),
    content: null,
    alive: 1,
  },
  {
    id: "38b97749-c608-817f-b560-c6382b6a3f5f",
    type: "bulleted_list",
    parent_id: summaryRootId,
    properties: JSON.stringify({ title: [["処理装置にシアノバクテリアの高濃度カートリッジを取り付けて循環させる方式を確認した"]] }),
    content: null,
    alive: 1,
  },
  {
    id: transcriptRootId,
    type: "text",
    parent_id: transcriptionId,
    properties: null,
    content: JSON.stringify(["38b97749-c608-806e-8d07-c5a0b2fd0231"]),
    alive: 1,
  },
  {
    id: "38b97749-c608-806e-8d07-c5a0b2fd0231",
    type: "text",
    parent_id: transcriptRootId,
    properties: JSON.stringify({
      title: [[
        "シアノバクテリアをどのように使うかというのはこちらにもアイデアがありまして、排水処理の条件について議論しました。通常の排水処理とは異なり、カートリッジを循環させる回収装置として扱うという説明がありました。三浦工業側からは排水処理の現場条件、有機物、雑菌、温度、重金属の取り込み方について確認があり、NDA締結後にサンプル提供へ進む流れを話しました。",
      ]],
    }),
    content: null,
    alive: 1,
  },
];

const matches = findMatchesFromRows(rows, {
  title: "SX MTG 三浦工業",
  date: "2026-06-26",
  eventId: "4so2kr7b2d19g67fk8ou181o9m",
}, { threshold: 48, maxSourceChars: 5000 });

assert.equal(matches.length, 1);
assert.equal(matches[0].page_id, pageId);
assert.equal(matches[0].confidence, "high");
assert.match(matches[0].summary_text, /排液サンプル/);
assert.match(matches[0].summary_text, /シアノバクテリア/);
assert.match(matches[0].source_text, /排水処理/);
assert.match(matches[0].source_hash, /^h1-local-notion:[0-9a-f]{64}$/);

console.log("✅ H-1 local Notion fallback fixture OK");
