(function ($) {
  "use strict";

  var sectionStateKey = "ch-home-sections-open";
  var savedSectionState = {};
  try { savedSectionState = JSON.parse(window.localStorage.getItem(sectionStateKey) || "{}"); } catch { savedSectionState = {}; }
  var activeTabKey = "ch-home-sections-tab";
  var $drawer = $(".ch-home-drawer");
  var $drawerContent = $drawer.find(".ch-home-drawer-content");
  var activeRow = null;
  var editorPlaceholder = null;
  var editorSnapshot = null;

  function activateTab(tab) {
    var $button = $('.ch-home-tab[data-tab="' + tab + '"]');
    if (!$button.length) return;
    $(".ch-home-tab").attr("aria-selected", "false").removeClass("is-active").attr("tabindex", "-1");
    $(".ch-home-panel").prop("hidden", true);
    $button.attr("aria-selected", "true").addClass("is-active").attr("tabindex", "0");
    $("#ch-panel-" + tab).prop("hidden", false);
    try { window.localStorage.setItem(activeTabKey, tab); } catch { /* Storage may be unavailable. */ }
    if (window.history && window.history.replaceState) window.history.replaceState(null, "", "#" + tab);
  }

  function refreshRowSummary($row) {
    var $editor = $row.find(".ch-home-row-editor");
    if (!$editor.length && activeRow && activeRow[0] === $row[0]) $editor = $drawerContent.children(".ch-home-row-editor");
    var $titleField = $editor.find('input[name$="[title]"]').first();
    var title = ($titleField.val() || "").trim();
    var $category = $editor.find('select[name$="[category_id]"]').first();
    if (!title && $category.length) title = $category.find("option:selected").text().trim();
    if (!title) title = "New homepage item";
    $row.find(".ch-home-row-title").text(title);
    var description = ($editor.find('textarea[name$="[blurb]"], input[name$="[caption]"]').first().val() || "").trim();
    $row.find(".ch-home-row-subtitle").text(description || ($category.length ? "" : "Homepage item"));
    var src = $editor.find(".ch-home-image-preview").attr("src");
    var $thumb = $row.find(".ch-home-row-thumb");
    if (src) $thumb.attr("src", src).prop("hidden", false);
    else $thumb.attr("src", "").prop("hidden", true);
  }

  function closeDrawer(applyChanges) {
    if (!activeRow) return;
    var $editor = $drawerContent.children(".ch-home-row-editor");
    if (!applyChanges && editorSnapshot) {
      editorSnapshot.forEach(function (entry) {
        if (!entry.element) return;
        if (entry.checked !== undefined) entry.element.checked = entry.checked;
        else entry.element.value = entry.value;
      });
      $drawerContent.find(".ch-home-image-preview").attr("src", editorSnapshot.imageSrc).prop("hidden", editorSnapshot.imageHidden);
      $drawerContent.find(".ch-home-remove-image").prop("hidden", editorSnapshot.imageHidden);
    }
    if (editorPlaceholder) editorPlaceholder.before($editor);
    $editor.prop("hidden", true);
    if (editorPlaceholder) editorPlaceholder.remove();
    editorPlaceholder = null;
    refreshRowSummary(activeRow);
    activeRow = null;
    editorSnapshot = null;
    $drawer.prop("hidden", true);
    $(".ch-home-drawer-backdrop").prop("hidden", true);
    $("body").removeClass("ch-home-drawer-open");
  }
  $(function () {
    var tab = (window.location.hash || "").replace(/^#/, "") || "";
    if (!$('.ch-home-tab[data-tab="' + tab + '"]').length) {
      try { tab = window.localStorage.getItem(activeTabKey) || ""; } catch { tab = ""; }
    }
    activateTab(tab || "characters");
    $(".ch-home-row").each(function () { refreshRowSummary($(this)); });
    $(".ch-home-section").each(function (index) {
      var key = $(this).children("summary").text().trim() || String(index);
      if (Object.prototype.hasOwnProperty.call(savedSectionState, key)) this.open = Boolean(savedSectionState[key]);
      this.dataset.stateKey = key;
      this.addEventListener("toggle", function () {
        savedSectionState[this.dataset.stateKey] = this.open;
        try { window.localStorage.setItem(sectionStateKey, JSON.stringify(savedSectionState)); } catch { /* Storage may be unavailable. */ }
      });
    });
  });

  $(document).on("click", ".ch-home-tab", function () { activateTab($(this).data("tab")); });
  $(document).on("keydown", ".ch-home-tab", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    var $tabs = $(".ch-home-tab");
    var index = $tabs.index(this) + (event.key === "ArrowRight" ? 1 : -1);
    if (index < 0) index = $tabs.length - 1;
    if (index >= $tabs.length) index = 0;
    $tabs.eq(index).trigger("focus").trigger("click");
  });

  $(document).on("click", ".ch-home-edit-row", function () {
    if (activeRow) closeDrawer(true);
    activeRow = $(this).closest(".ch-home-row");
    var $editor = activeRow.children(".ch-home-row-editor");
    editorSnapshot = $editor.find(":input").toArray().map(function (element) {
      return { element: element, value: element.value, checked: element.type === "checkbox" ? element.checked : undefined };
    });
    editorSnapshot.imageSrc = $editor.find(".ch-home-image-preview").attr("src") || "";
    editorSnapshot.imageHidden = $editor.find(".ch-home-image-preview").prop("hidden");
    editorPlaceholder = $('<div class="ch-home-editor-placeholder"></div>');
    $editor.before(editorPlaceholder);
    $drawerContent.append($editor);
    $editor.prop("hidden", false);
    $drawerContent.scrollTop(0);
    $drawer.prop("hidden", false);
    $(".ch-home-drawer-backdrop").prop("hidden", false);
    $("body").addClass("ch-home-drawer-open");
    $drawer.find(".ch-home-drawer-close").trigger("focus");
  });
  $(document).on("click", ".ch-home-drawer-apply", function () { closeDrawer(true); });
  $(document).on("click", ".ch-home-drawer-cancel, .ch-home-drawer-close, .ch-home-drawer-backdrop", function () { closeDrawer(false); });
  $(document).on("keydown", function (event) {
    if (event.key === "Escape" && activeRow) closeDrawer(false);
  });
  $(document).on("input change", ".ch-home-sections :input", function () {
    $(".ch-home-savebar").addClass("is-dirty");
  });

  function nextRowIndex($container) {
    var highest = -1;
    $container.find("[name]").each(function () {
      var match = this.name.match(/\[(\d+)\]\[/);
      if (match) highest = Math.max(highest, Number(match[1]));
    });
    return highest + 1;
  }

  $(document).on("click", ".ch-home-add-row", function () {
    var section = $(this).data("section");
    var $container = $('.ch-home-rows[data-section="' + section + '"]');
    var index = nextRowIndex($container);
    var limit = Number($container.data("limit")) || 8;
    if ($container.children(".ch-home-row").length >= limit) {
      window.alert("You can add up to " + limit + " cards in this section.");
      return;
    }

    var html = $("#ch-home-row-template-" + section).html();
    html = html.replace(/__SECTION__/g, section).replace(/__INDEX__/g, index);
    var $row = $(html);
    $container.append($row);
    refreshRowSummary($row);
    $(".ch-home-savebar").addClass("is-dirty");
  });

  $(document).on("click", ".ch-home-remove-row", function () {
    $(this).closest(".ch-home-row").remove();
    $(".ch-home-savebar").addClass("is-dirty");
  });

  $(document).on("click", ".ch-home-move-up", function () {
    var $row = $(this).closest(".ch-home-row");
    $row.prev(".ch-home-row").before($row);
    $(".ch-home-savebar").addClass("is-dirty");
  });

  $(document).on("click", ".ch-home-move-down", function () {
    var $row = $(this).closest(".ch-home-row");
    $row.next(".ch-home-row").after($row);
    $(".ch-home-savebar").addClass("is-dirty");
  });

  $(document).on("click", ".ch-home-select-image", function (event) {
    event.preventDefault();
    var $row = $(this).closest(".ch-home-row");
    if (!$row.length) $row = activeRow;
    var picker = wp.media({
      title: "Choose a card thumbnail",
      button: { text: "Use this image" },
      library: { type: "image" },
      multiple: false,
    });

    picker.on("select", function () {
      var attachment = picker.state().get("selection").first().toJSON();
      var source =
        attachment.sizes && attachment.sizes.thumbnail
          ? attachment.sizes.thumbnail.url
          : attachment.url;
      var $fields = activeRow && $row[0] === activeRow[0] ? $drawerContent.children(".ch-home-row-editor") : $row;
      $fields.find(".ch-home-image-id").val(attachment.id);
      $fields.find(".ch-home-image-preview").attr("src", source).prop("hidden", false);
      $fields.find(".ch-home-remove-image").prop("hidden", false);
      refreshRowSummary($row);
      $(".ch-home-savebar").addClass("is-dirty");
    });
    picker.open();
  });

  $(document).on("click", ".ch-home-remove-image", function () {
    var $row = $(this).closest(".ch-home-row");
    if (!$row.length) $row = activeRow;
    var $fields = activeRow && $row[0] === activeRow[0] ? $drawerContent.children(".ch-home-row-editor") : $row;
    $fields.find(".ch-home-image-id").val("");
    $fields.find(".ch-home-image-preview").attr("src", "").prop("hidden", true);
    $fields.find(".ch-home-remove-image").prop("hidden", true);
    refreshRowSummary($row);
    $(".ch-home-savebar").addClass("is-dirty");
  });

  // PHP preserves submitted field order; renumber after moves and before saving.
  $(document).on("submit", ".ch-home-sections form", function () {
    if (activeRow) closeDrawer(true);
    $(this).find(".ch-home-rows").each(function () {
      $(this).children(".ch-home-row").each(function (index) {
        $(this).find("[name]").each(function () {
          this.name = this.name.replace(/\[\d+\](?=\[)/, "[" + index + "]");
        });
      });
    });
  });
})(jQuery);
