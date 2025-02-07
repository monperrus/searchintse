var globalConfig;
var globalCSVData;

$(window).bind("load", function () {
	results = null;
	currentTab = "papers";


	$.ajax({
		url: "/annotations",
		type: "GET",
		success: function (data) {
			// Parse CSV with papaparse
			Papa.parse(data, {
				header: true,
				complete: function (results) {
					globalCSVData = results.data;
				}
			});

		}
	});

	$.ajax({
		url: "/config",
		type: "GET",
		success: function (data) {
			globalConfig = data;
		}
	});

	f = document.getElementById("query_field");
	f.style.height = "0px";
	f.style.height = f.scrollHeight + "px";

	// Making the textfield and placeholder act nice on iOS.
	$("#query_field").focus(function () {
		$("#query_field").addClass("placeholder_hidden");
	});

	$("#query_field").blur(function () {
		$("#query_field").removeClass("placeholder_hidden");
	});

	// Only autofocus the textfield if on desktop
	if (/Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)) {
		$("#query_field").blur();
	} else {
		$("#query_field").focus();
	}

	// Expand textfield in accordance with text length
	$("#query_field").on("input", function () {
		this.style.height = 0;
		this.style.height = (this.scrollHeight) + "px";
	});

	// Handle toggling between papers and authors tabs
	$(".toggle").on("click", function () {
		if (this.dataset.tab == "papers") {
			togglePapersTab(true);
		} else {
			togglePeopleTab(true);
		}
	});

	// Toggle the right tab
	tabGetParameter = findGetParameter("tab");
	if (tabGetParameter != null) {
		if (tabGetParameter.toLowerCase() == "people") {
			currentTab = "people";
		} else {
			currentTab = "papers";
		}
	}

	// Insert query if present as GET parameter
	queryGetParameter = findGetParameter("q");
	if (queryGetParameter != null) {
		$("#query_field").val(queryGetParameter);
		$("#query_field").trigger("input"); // trigger resize
		performSearch();
	}

	// Listen for when user hits return
	$("#query_field").keypress(function (e) {
		if (e.which == 13) {
			performSearch();
			return false;
		}
	});


});

function togglePapersTab(animated) {
	$('[data-tab="papers"]').first().addClass("toggle_enabled");
	$('[data-tab="people"]').first().removeClass("toggle_enabled");
	if (animated) {
		if ($("#results").hasClass("move_up")) {
			$("#results").removeClass("move_up");
			$("#results").on("transitionend", function () {
				addPapers(results["papers"]);
				$("#results").addClass("move_up");
			});
		} else {
			addPapers(results["papers"]);
			$("#results").addClass("move_up");
		}
	} else {
		addPapers(results["papers"]);
	}
	queryVal = findGetParameter("q");
	currentTab = "papers";
	updateGetParameter(queryVal, currentTab);
}

function togglePeopleTab(animated) {
	$('[data-tab="people"]').first().addClass("toggle_enabled");
	$('[data-tab="papers"]').first().removeClass("toggle_enabled");
	if (animated) {
		if ($("#results").hasClass("move_up")) {
			$("#results").removeClass("move_up");
			$("#results").on("transitionend", function () {
				addAuthors(results["authors"]);
				$("#results").addClass("move_up");
			});
		} else {
			addAuthors(results["authors"]);
			$("#results").addClass("move_up");
		}
	} else {
		addAuthors(results["authors"]);
	}
	queryVal = findGetParameter("q");
	currentTab = "people";
	updateGetParameter(queryVal, currentTab);
}

function performSearch() {
	// Change textfield appearance
	field = document.getElementById("query_field");
	field.style.animationName = "change_color";
	field.readOnly = true;
	$(field).blur();

	let queryVal = $('textarea[name="query"]').val();

	// Submit request to backend
	$.getJSON("/search", {
		query: queryVal
	}, function (data) {
		field.style.animationName = "";
		field.readOnly = false;
		if (data["error"] == null) {
			results = data;
			updateGetParameter(queryVal, currentTab);
			$("#error_container").hide();
			$("#tip").hide();
			if (currentTab == "people") {
				togglePeopleTab(true);
			} else {
				togglePapersTab(true);
			}
			/*$("#toggle_container").show();*/
			$("#toggle_container").addClass("appear");
		} else {
			$("#error_text").text(data["error"]);
			$("#error_container").show();
		}
	});
}

function findGetParameter(parameterName) {
	var result = null;
	var tmp = [];
	location.search.substr(1).split("&").forEach(function (item) {
		tmp = item.split("=");
		if (tmp[0] === parameterName) {
			result = decodeURIComponent(tmp[1]);
		}
	});
	return result;
}

function updateGetParameter(query, tab) {
	protocol = window.location.protocol + "//";
	host = window.location.host;
	pathname = window.location.pathname;
	queryParam = `?q=${encodeURIComponent(query)}`
	tabParam = `&tab=${encodeURIComponent(tab)}`
	newUrl = protocol + host + pathname + queryParam + tabParam
	window.history.pushState({ path: newUrl }, '', newUrl);
}

function renderMath() {
	let config = [{ left: "$$", right: "$$", display: true },
	{ left: "$", right: "$", display: false }];
	renderMathInElement(document.body, { delimiters: config });
}

function resultClicked(e) {
	$(e).removeClass("result_clickable");
	$(e).find(".result_abstract").removeClass("truncated_text");
	$(e).find(".result_button_container").show();
}

function addPapers(data) {
	$("#results").empty();
	var html = "";
	data.forEach(e => {
		html += addPaper(e)
	})
	$("#results").append(html);
	$("#results").addClass("move_up");
	renderMath();
}

function addPaper(result) {
	let dotClass = result.score >= 0.80 ? "dot_green" : "dot_orange";
	return `<div class="search_result result_clickable" onclick="resultClicked(this)">
    <div class="result_top">
    <div class="result_year black"><p>${result.year}</p></div>
    <div class="result_score black" title="Cosine similarity">
        <p>${result.score}</p>
        <div class="result_dot ${dotClass}"></div>
    </div>
    </div>
    <p class="result_title black">
    ${result.title}
    </p>
    <p class="result_authors">${result.authors}</p>
    <!-- <p class="result_abstract truncated_text black">${result.abstract}</p> -->
    <div class="result_button_container">
    <div class="result_button_flex">
        <a href="${result.url}" target="_blank">
        <div class="result_button">
            <div class="go_to_symbol"></div>
            <p>Go to Paper</p>
        </div>
        </a>
        <!-- find similar -->
		<!-- <a href="/?q=${encodeURIComponent(result.id)}" target="_blank">
        <div class="result_button">
            <div class="similarity_symbol"></div>
            <p>Find Similar</p>
        </div>
        </a> -->
        <div class="result_button" onclick="showEmbedding('${result.id}', event)">
            <div class="embedding_symbol"></div>
            <p>Show Embedding</p>
        </div>
    </div>
    </div>
</div>`
}

function showEmbedding(id, event) {
    event.stopPropagation();
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'embedding-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    // Create modal content with styling
    const content = document.createElement('div');
    content.style.cssText = `
        /* embedding background: white; */
        padding: 10px;
        border-radius: 8px;
        max-width: 800px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    `;
    
    // Add loading indicator
    content.innerHTML = '<h3>Loading embedding visualization...</h3>';
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Fetch and display embedding data
    fetch(`/embedding?id=${encodeURIComponent(id)}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                content.innerHTML = `<h3>Error</h3><p>${data.error}</p>`;
                return;
            }
            const normalized = normalizeEmbedding(data);
            content.innerHTML = `
                <div style="text-align: center;">
                    <h3 style="margin-bottom: 20px;">Embedding Visualization</h3>
                    <div class="heatmap" style="margin: 20px 0;">${createHeatmap(normalized)}</div>
                    <button onclick="this.closest('.embedding-modal').remove()" 
                            style="padding: 8px 16px; 
                                   border: none; 
                                   background: #007bff; 
                                   color: white; 
                                   border-radius: 4px; 
                                   cursor: pointer;">
                        Close
                    </button>
                </div>
            `;
        });
}

function normalizeEmbedding(embedding) {
    const min = Math.min(...embedding);
    const max = Math.max(...embedding);
    return embedding.map(v => (v - min) / (max - min));
}

function createHeatmap(normalized) {
    const width = 32;
    let html = '<div class="heatmap-grid" style="display: grid; grid-template-columns: repeat(32, 1fr); gap: 1px; background: #eee; padding: 10px;">';
    
    normalized.forEach(value => {
        const color = getHeatmapColor(value);
        html += `<div style="aspect-ratio: 1; background-color: ${color};"></div>`;
    });
    
    return html + '</div>';
}

function getHeatmapColor(value) {
    // Convert value to a blue-red gradient
    const r = Math.floor(value * 255);
    const b = Math.floor((1 - value) * 255);
    return `rgb(${r}, 0, ${b})`;
}

function addAuthors(authors) {
	$("#results").empty();
	var html = '<div id="authors_flex">';

	authors.forEach(author => {
		html += addAuthor(author)
	})
	html += '</div>'
	$("#results").append(html);
	$("#results").addClass("move_up");
	renderMath();
}

function addAuthor(author) {
	// if the author is in globalCSVData, add the annotations
	author.annotation = {};
	author.annotation.value = "";
	if (globalCSVData && globalConfig.capabilities.includes("credit")) {
		    // swith author.author to lastname, firstname
			if (!author.author.includes(",")) {
				author.author = author.author.split(" ").reverse().join(", ");
			}
			let annotationData = globalCSVData.find(p => p["Author Full Name"] == author.author);
			if (annotationData) {
				author.annotation = annotationData;
				// the csv is the debt 
				author.annotation.value = -annotationData["Reviewer Debt (Accepted Papers * 3 - Reviews Completed - Papers Handled) "];
			}
	}
	let dotClass = author.annotation.value > 0 ? "dot_green" : "dot_orange";
	tooltip = JSON.stringify(author.annotation).replaceAll('"', "");
	annotation_div = "";
	if (author.annotation.value != "") {
		annotation_div = `<div class="result_score black">
			<p>Credits: ${author.annotation.value}</p>
			<div class="result_dot ${dotClass}"></div>
		</div>`;
	}
	html = `<div class="author_container">
    <div class="author_top_row" title="${tooltip}">
    <p class="author_name black">${author.author}</p>
    ${annotation_div}  
    </div>
    <div class="num_papers_container">
    <div class="author_num_papers_info_symbol" data-author="${author.author}" onmouseover="infoHover(this)" onmouseout="infoLeave()"></div>
    <p class="author_num_papers black">${author.papers.length} matching papers</p>
    </div>
		<div class="info_container" data-author="${author.author}">
			<p class="black">Based on your query, we retrieved 100 papers. Of those, <b>${author.author}</b> was (co-) author on <b>${author.papers.length}</b>.</p>
		</div>`
	author.papers.forEach(paper => {
		html += `<a href="https://doi.org/${encodeURIComponent(paper.id.replace("#","/"))}" class="author_paper" target="_blank">${paper.title}</a>`;
	});
	html += "</div>"
	return html
}

function infoHover(elem) {
	pos = $(elem).position();
	width = $(elem).width();
	height = $(elem).height();
	offsetLeft = $(elem).offset().left;
	infoAuthor = elem.dataset.author;
	$(".info_container").each(function(i, obj) {
		containerAuthor = obj.dataset.author;
		if (infoAuthor != containerAuthor) return
		centerX = pos.left + width / 2;
		bottomY = pos.top + height;
		containerWidth = $(obj).width();
		left = centerX-containerWidth/2;
		minLeftMargin = 10;
		if (left < minLeftMargin) {
			diff = minLeftMargin - left;
			$(obj).css({top: bottomY+10+"px", left: left+diff/2+"px", display: "block"});
		} else {
			$(obj).css({top: bottomY+10+"px", left: left+"px", display: "block"});
		}
	});
}

function infoLeave() {
	$(".info_container").each(function(i, obj) {
		$(obj).hide();
	});
}
