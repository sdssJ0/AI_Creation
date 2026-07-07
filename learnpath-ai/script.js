const el = (id) => document.getElementById(id);

const queryInput = el("queryInput");
const searchBtn = el("searchBtn");
const loading = el("loading");
const loadingStatus = el("loadingStatus");
const loadingBarFill = el("loadingBarFill");
const step1 = el("step1");
const step2 = el("step2");
const step3 = el("step3");
const error = el("error");
const errorMsg = el("errorMsg");
const retryBtn = el("retryBtn");
const results = el("results");
const analysisTopic = el("analysisTopic");
const analysisBadge = el("analysisBadge");
const analysisDesc = el("analysisDesc");
const analysisSubtopics = el("analysisSubtopics");
const analysisKeywords = el("analysisKeywords");
const resultsCount = el("resultsCount");
const videoList = el("videoList");

// Settings
let apiConfig = {
    api_key: "cbb7c1f1d7114c40867fa6112f95db3b",
    api_url: "https://genaiapi.shanghaitech.edu.cn/api/v1/start",
    api_model: "deepseek-chat"
};

function loadSettings() {
    try {
        var saved = localStorage.getItem("learnpath_api_config");
        if (saved) {
            var parsed = JSON.parse(saved);
            if (parsed.api_key) apiConfig.api_key = parsed.api_key;
            if (parsed.api_url) apiConfig.api_url = parsed.api_url;
            if (parsed.api_model) apiConfig.api_model = parsed.api_model;
        }
    } catch(e) {}
}

function saveSettings() {
    localStorage.setItem("learnpath_api_config", JSON.stringify(apiConfig));
}

function openSettings() {
    el("apiUrl").value = apiConfig.api_url;
    el("apiKey").value = apiConfig.api_key;
    el("apiModel").value = apiConfig.api_model;
    el("settingsOverlay").classList.remove("hidden");
}

function closeSettings() {
    el("settingsOverlay").classList.add("hidden");
}

loadSettings();

el("settingsBtn").addEventListener("click", openSettings);
el("settingsClose").addEventListener("click", closeSettings);
el("settingsOverlay").addEventListener("click", function(e) {
    if (e.target === this) closeSettings();
});
el("settingsSave").addEventListener("click", function() {
    apiConfig.api_key = el("apiKey").value.trim() || "cbb7c1f1d7114c40867fa6112f95db3b";
    apiConfig.api_url = el("apiUrl").value.trim() || "https://genaiapi.shanghaitech.edu.cn/api/v1/start";
    apiConfig.api_model = el("apiModel").value.trim() || "deepseek-chat";
    saveSettings();
    closeSettings();
});

let lastQuery = "";

// Hint buttons
document.querySelectorAll(".hint-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        queryInput.value = btn.dataset.query;
        doSearch();
    });
});

// Enter to search
queryInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSearch();
    }
});

searchBtn.addEventListener("click", doSearch);
retryBtn.addEventListener("click", doSearch);

function formatNumber(n) {
    if (!n) return "0";
    n = Number(n);
    if (n >= 10000) return (n / 10000).toFixed(1) + "万";
    return n.toLocaleString();
}

function formatDuration(d) {
    if (!d) return "";
    const parts = d.split(":").map(Number);
    if (parts.length === 2) return `${parts[0]}:${String(parts[1]).padStart(2, "0")}`;
    if (parts.length === 3) return `${parts[0]}:${String(parts[1]).padStart(2, "0")}:${String(parts[2]).padStart(2, "0")}`;
    return d;
}

function timeAgo(ts) {
    if (!ts) return "";
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 86400) return "今天";
    if (diff < 172800) return "昨天";
    if (diff < 2592000) return Math.floor(diff / 86400) + "天前";
    return Math.floor(diff / 2592000) + "月前";
}

const icons = {
    play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    message: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    star: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    sparkles: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M20 2v4"/><path d="M22 4h-4"/></svg>`,
    thumbsUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>`,
};

function updateLoading(step, status) {
    loadingStatus.textContent = status;
    const steps = [step1, step2, step3];
    steps.forEach((s, i) => {
        s.classList.remove("active", "done");
        if (i < step) s.classList.add("done");
        else if (i === step) s.classList.add("active");
    });
    const pcts = [0, 33, 66, 100];
    loadingBarFill.style.width = pcts[step] + "%";
}

async function doSearch() {
    const query = queryInput.value.trim();
    if (!query) { queryInput.focus(); return; }
    lastQuery = query;
    results.classList.add("hidden");
    error.classList.add("hidden");
    loading.classList.remove("hidden");
    searchBtn.disabled = true;
    updateLoading(0, "AI 正在分析你的学习需求...");
    try {
        updateLoading(1, "正在搜索 B站 优质教程...");
        await new Promise((r) => setTimeout(r, 300));
        updateLoading(2, "AI 正在智能匹配最适合你的视频...");
        await new Promise((r) => setTimeout(r, 200));
        const resp = await fetch("/api/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query, api_config: apiConfig }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || "请求失败");
        loading.classList.add("hidden");
        renderResults(data, query);
    } catch (err) {
        loading.classList.add("hidden");
        error.classList.remove("hidden");
        errorMsg.textContent = err.message;
    } finally {
        searchBtn.disabled = false;
    }
}

function renderResults(data, query) {
    const roadmap = data.roadmap || [];
    const analysis = data.analysis || {};
    const videos = data.videos || [];

    analysisTopic.textContent = analysis.topic || query;
    const badgeLabels = { beginner: "入门", intermediate: "进阶", advanced: "高级" };
    analysisBadge.textContent = badgeLabels[analysis.difficulty] || "";
    analysisBadge.className = "analysis-badge " + (analysis.difficulty || "beginner");
    analysisDesc.textContent = analysis.description || "";
    analysisSubtopics.innerHTML = "";
    (analysis.subtopics || []).forEach((s) => {
        const tag = document.createElement("span");
        tag.className = "subtopic-tag";
        tag.textContent = s;
        analysisSubtopics.appendChild(tag);
    });
    analysisKeywords.innerHTML = '<span class="keywords-label">搜索关键词：</span>';
    (analysis.keywords || []).forEach((k) => {
        const tag = document.createElement("span");
        tag.className = "keyword-tag";
        tag.textContent = k;
        analysisKeywords.appendChild(tag);
    });

    renderRoadmap(roadmap, videos);

    resultsCount.textContent = `共找到 ${videos.length} 个视频`;
    videoList.innerHTML = "";
    if (videos.length === 0) {
        videoList.innerHTML = `<div class="empty">暂无匹配视频，请尝试其他关键词</div>`;
    }
    videos.forEach((v, i) => {
        const card = document.createElement("a");
        card.className = "video-card";
        card.href = v.arcurl || `https://www.bilibili.com/video/${v.bvid}`;
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        const score = v.ai_score || 5;
        const stars = Math.round(score / 2);
        const starHtml = icons.star.replace('stroke-width="2"', 'fill="#f59e0b" stroke="#f59e0b"');
        const starsStr = Array(stars).fill(starHtml).join("");
        card.innerHTML = `<img class="video-thumb" src="${v.pic || ""}" alt="${v.title}" loading="lazy" onerror="this.src=\'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22280%22 height=%22158%22><rect fill=%22%23e8eaee%22 width=%22280%22 height=%22158%22/></svg>\'">
<div class="video-info">
<div><span class="video-order">${v.suggested_order || (i + 1)}</span><span class="video-title">${escapeHtml(v.title)}</span></div>
<div class="video-meta">
<span class="video-meta-item">${icons.eye} ${formatNumber(v.play)}</span>
<span class="video-meta-item">${icons.message} ${formatNumber(v.danmaku)}</span>
<span class="video-meta-item">${icons.play} ${formatDuration(v.duration)}</span>
<span class="video-meta-item">${icons.thumbsUp} ${formatNumber(v.like)}</span>
<span class="video-meta-item">${v.author}</span>
<span class="video-meta-item">${timeAgo(v.pubdate)}</span>
<span class="video-score">${starsStr} ${score.toFixed(1)}</span>
</div>
<div class="video-desc">${escapeHtml(v.description || "")}</div>
${v.relevance_reason ? `<div class="video-reason">${icons.sparkles} AI推荐：${escapeHtml(v.relevance_reason)}</div>` : ""}
</div>`;
        videoList.appendChild(card);
    });
    results.classList.remove("hidden");
    results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderRoadmap(roadmap, videos) {
    const container = el("roadmap");
    container.classList.add("hidden");
    container.innerHTML = "";
    if (!roadmap || roadmap.length === 0) return;

    const stepVideos = {};
    roadmap.forEach(function(step) { stepVideos[step.step] = []; });
    stepVideos[0] = [];

    videos.forEach(function(v) {
        const step = v.roadmap_step || 0;
        if (!stepVideos[step]) stepVideos[step] = [];
        stepVideos[step].push(v);
    });

    let html = '<div class="roadmap-title">' + icons.sparkles + "推荐学习路线</div>";
    html += '<div class="roadmap-steps">';

    roadmap.forEach(function(step) {
        html += '<div class="roadmap-step">';
        html += '<div class="roadmap-step-dot active">' + step.step + "</div>";
        html += '<div class="roadmap-step-title">' + escapeHtml(step.title) + "</div>";
        html += '<div class="roadmap-step-desc">' + escapeHtml(step.description) + "</div>";

        const sv = stepVideos[step.step] || [];
        if (sv.length > 0) {
            html += '<div class="roadmap-step-videos">';
            sv.forEach(function(v) {
                const order = v.suggested_order || 0;
                const title = escapeHtml(v.title).substring(0, 45);
                const bvid = v.bvid;
                html += '<div class="roadmap-video-tag" data-bvid="' + bvid;
                html += '" onclick="scrollToVideo(\' + bvid + \')">';
                html += '<span class="order-badge">' + order + '</span> ';
                html += title + '</div>';
            });
            html += "</div>";
        }
        html += "</div>";
    });

    html += "</div>";
    container.innerHTML = html;
    container.classList.remove("hidden");
}

function scrollToVideo(bvid) {
    const cards = document.querySelectorAll(".video-card");
    for (let i = 0; i < cards.length; i++) {
        if (cards[i].href.indexOf(bvid) >= 0) {
            cards[i].scrollIntoView({ behavior: "smooth", block: "center" });
            cards[i].style.borderColor = "#4f46e5";
            cards[i].style.boxShadow = "0 0 0 3px rgba(79,70,229,0.15)";
            const card = cards[i];
            setTimeout(function() {
                card.style.borderColor = "";
                card.style.boxShadow = "";
            }, 2000);
            break;
        }
    }
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
