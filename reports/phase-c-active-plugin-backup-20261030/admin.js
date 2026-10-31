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
  var validationErrorId = 0;

  function activateTab(tab) {
    var $button = $('.ch-home-tab[data-tab="' + tab + '"]');
    if (!$button.length) return;
    $(".ch-home-tab").attr("aria-selected", "false").removeClass("is-active").attr("tabindex", "-1");
    $(".ch-home-panel").prop("hidden", true);
    $button.attr("aria-selected", "true").addClass("is-active").attr("tabindex", "0");
    $("#ch-panel-" + tab).prop("hidden", false);
    if (tab === "hero") activateHeroTab("content");
    try { window.localStorage.setItem(activeTabKey, tab); } catch { /* Storage may be unavailable. */ }
    if (window.history && window.history.replaceState) window.history.replaceState(null, "", "#" + tab);
  }

  function activateHeroTab(tab) {
    var $button = $('.ch-home-subtab[data-hero-tab="' + tab + '"]');
    if (!$button.length) return;
    $("#ch-panel-hero .ch-home-subtab").attr("aria-selected", "false").attr("tabindex", "-1").removeClass("is-active");
    $(".ch-home-hero-subpanel").prop("hidden", true).attr("aria-hidden", "true");
    $button.attr("aria-selected", "true").attr("tabindex", "0").addClass("is-active");
    $("#ch-hero-panel-" + tab).prop("hidden", false).attr("aria-hidden", "false").attr("tabindex", "0");
  }

  function activateSectionSubtab(target, tab) {
    var $scope = $("#ch-panel-" + target);
    if (!$scope.length) return;
    $scope.find("[data-section-subtab]").attr("aria-selected", "false").attr("tabindex", "-1").removeClass("is-active");
    $scope.find("[data-section-pane]").prop("hidden", true);
    $scope.find('[data-section-subtab="' + tab + '"]').attr("aria-selected", "true").attr("tabindex", "0").addClass("is-active");
    $scope.find('[data-section-pane="' + tab + '"]').prop("hidden", false);
  }

  function syncHeroImageSlot($slot, nextMode, previousMode) {
    var $id = $slot.find(".ch-home-image-id");
    var $link = $slot.find('input[name$="[link_url]"]');
    var $preview = $slot.find(".ch-home-image-preview");
    var defaultId = Number($slot.attr("data-default-id")) || 0;
    var defaultSrc = $slot.attr("data-default-src") || "";
    if (nextMode === "default") {
      $id.val("");
      $link.val("");
      $preview.attr("src", defaultSrc).prop("hidden", !defaultSrc);
      $slot.find(".ch-home-image-empty").prop("hidden", Boolean(defaultSrc));
      $slot.find(".ch-home-image-state").text(defaultSrc ? "Effective default image" : "No default image available");
      $slot.find(".ch-home-remove-hero-image, .ch-home-restore-image").prop("hidden", true);
    } else {
      if (previousMode !== "custom") {
        $id.val(defaultId || "");
        $preview.attr("src", defaultSrc).prop("hidden", !defaultSrc);
      }
      var hasImage = Boolean($id.val());
      $slot.find(".ch-home-image-empty").prop("hidden", hasImage);
      $slot.find(".ch-home-image-state").text(hasImage ? "Custom image override" : "Custom image cleared");
      $slot.find(".ch-home-remove-hero-image").prop("hidden", !hasImage);
      $slot.find(".ch-home-restore-image").prop("hidden", false);
    }
    $slot.attr("data-mode", nextMode);
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

  function clearFieldError($field) {
    var errorId = $field.attr("data-ch-home-error");
    if (errorId) $("#" + errorId).remove();
    $field.removeAttr("data-ch-home-error").removeAttr("aria-invalid");
    var describedBy = ($field.attr("aria-describedby") || "").split(/\s+/).filter(function (id) {
      return id && id !== errorId;
    });
    if (describedBy.length) $field.attr("aria-describedby", describedBy.join(" "));
    else $field.removeAttr("aria-describedby");
  }

  function clearValidationErrors($scope) {
    $scope.find("[data-ch-home-error]").each(function () { clearFieldError($(this)); });
  }

  function setFieldError($field, message) {
    if (!$field.length) return;
    clearFieldError($field);
    var errorId = "ch-home-validation-error-" + (++validationErrorId);
    var $error = $("<span>", { id: errorId, "class": "ch-home-field-error", role: "alert" }).text(message);
    var $label = $field.closest("label");
    if ($label.length) $label.append($error);
    else $field.after($error);
    $field.attr("data-ch-home-error", errorId).attr("aria-invalid", "true");
    var describedBy = ($field.attr("aria-describedby") || "").split(/\s+/).filter(Boolean);
    describedBy.push(errorId);
    $field.attr("aria-describedby", describedBy.join(" "));
  }

  function validPackUrl(value) {
    if (/^\/(?!\/)/.test(value)) return true;
    try {
      var url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
    } catch {
      return false;
    }
  }

  function validHomepageDestination(value) {
    if (/^\/(?!\/)[^\\\s]*$/.test(value)) return true;
    try {
      var url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.port && ["creativehatti.com", "www.creativehatti.com"].includes(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function validateSettingsForm($form) {
    var firstInvalid = null;
    function error($field, message) {
      if (!$field.length) return;
      setFieldError($field, message);
      if (!firstInvalid) firstInvalid = $field;
    }

    $form.find('input[type="number"], input[type="date"]').each(function () {
      var $field = $(this);
      if (this.type === "number" && this.value === "") return;
      if (this.validity && !this.validity.valid) {
        var min = $field.attr("min");
        var max = $field.attr("max");
        var message = min !== undefined && max !== undefined
          ? "Enter a value from " + min + " to " + max + "."
          : "Enter a valid value.";
        error($field, message);
      }
    });

    $form.find('.ch-home-hero-image input[name$="[link_url]"]').each(function () {
      var $field = $(this);
      var value = ($field.val() || "").trim();
      if (value && !validPackUrl(value)) error($field, "Use an http(s) URL or a site-relative path beginning with one slash.");
    });

    $form.find('.ch-home-copy-field input[type="url"]').each(function () {
      var $field = $(this);
      var value = ($field.val() || "").trim();
      if (value && !validHomepageDestination(value)) error($field, "Use a site-relative path beginning with one slash or an HTTPS creativehatti.com URL.");
    });

    var packMode = $form.find('[name="ch_home_sections[packs_mode]"]').val();
    $form.find(".ch-home-pack-row").each(function () {
      var $row = $(this);
      var $title = $row.find('input[name$="[title]"]').first();
      var $category = $row.find('select[name$="[category_id]"]').first();
      var $url = $row.find('input[name$="[link_url]"]').first();
      var $query = $row.find('input[name$="[query]"]').first();
      var $blurb = $row.find('textarea[name$="[blurb]"]').first();
      var $image = $row.find(".ch-home-image-id").first();
      var hasCategory = Number($category.val()) > 0;
      var title = ($title.val() || "").trim();
      var link = ($url.val() || "").trim();
      var query = ($query.val() || "").trim();
      var populated = hasCategory || title || link || query || ($blurb.val() || "").trim() || Number($image.val()) > 0;
      if (!populated) return;

      if (!hasCategory && !link && !query) {
        error($category, "Choose an EDD category or enter a destination URL or search query.");
      }
      if (!hasCategory && !title) {
        error($title, "Add a collection title when no EDD category is selected.");
      }
      if (link && !validPackUrl(link)) {
        error($url, "Use an http(s) URL or a site-relative path beginning with one slash.");
      }

      if (packMode === "automatic" && $row.find('select[name$="[display_mode]"]').val() === "seasonal") {
        var $start = $row.find('input[name$="[start_date]"]').first();
        var $end = $row.find('input[name$="[end_date]"]').first();
        var start = $start.val() || "";
        var end = $end.val() || "";
        if (!start) error($start, "Add a start date for automatic seasonal rotation.");
        if (!end) error($end, "Add an end date for automatic seasonal rotation.");
        if (start && end && start > end && !$row.find('input[name$="[annual]"]').prop("checked")) {
          error($start, "The start date must not be after the end date.");
          error($end, "The end date must not be before the start date.");
        }
      } else {
        var $startDate = $row.find('input[name$="[start_date]"]').first();
        var $endDate = $row.find('input[name$="[end_date]"]').first();
        if ($startDate.val() && $endDate.val() && $startDate.val() > $endDate.val() && !$row.find('input[name$="[annual]"]').prop("checked")) {
          error($startDate, "The start date must not be after the end date.");
          error($endDate, "The end date must not be before the start date.");
        }
      }
    });

    $form.find('.ch-home-rows[data-section="celebrations"] .ch-home-row').each(function () {
      var $row = $(this);
      var $from = $row.find('input[name$="[show_from]"]').first();
      var $until = $row.find('input[name$="[hide_after]"]').first();
      if ($from.val() && $until.val() && $from.val() > $until.val()) {
        error($from, "Show-from date must not be after the hide-after date.");
        error($until, "Hide-after date must not be before the show-from date.");
      }
    });

    return firstInvalid;
  }

  function revealField($field) {
    var $panel = $field.closest(".ch-home-panel");
    var section = $panel.attr("data-panel") || "packs";
    activateTab(section);
    var $row = $field.closest(".ch-home-row");
    if ($row.length && $row.find(".ch-home-edit-row").length) {
      $row.find(".ch-home-edit-row").trigger("click");
    }
    window.setTimeout(function () { $field.trigger("focus"); }, 0);
  }
  $(function () {
    var params = new URLSearchParams(window.location.search);
    var tab = params.get("ch_tab") || (window.location.hash || "").replace(/^#/, "") || "";
    if (!$('.ch-home-tab[data-tab="' + tab + '"]').length) {
      try { tab = window.localStorage.getItem(activeTabKey) || ""; } catch { tab = ""; }
    }
    activateTab(tab || "characters");
    activateHeroTab("content");
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
  $(document).on("click", ".ch-home-subtab[data-hero-tab]", function () { activateHeroTab($(this).data("hero-tab")); });
  $(document).on("click", "[data-section-subtab]", function () { activateSectionSubtab($(this).data("section-target"), $(this).data("section-subtab")); });
  $(document).on("keydown", ".ch-home-subtab[data-hero-tab]", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    var $tabs = $(".ch-home-subtab");
    var index = $tabs.index(this) + (event.key === "ArrowRight" ? 1 : -1);
    if (index < 0) index = $tabs.length - 1;
    if (index >= $tabs.length) index = 0;
    $tabs.eq(index).trigger("focus").trigger("click");
  });
  $(document).on("keydown", "[data-section-subtab]", function (event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    var $tabs = $(this).closest("nav").find("[data-section-subtab]");
    var index = $tabs.index(this) + (event.key === "ArrowRight" ? 1 : -1);
    if (index < 0) index = $tabs.length - 1;
    if (index >= $tabs.length) index = 0;
    $tabs.eq(index).trigger("focus").trigger("click");
  });

  $(document).on("click", ".ch-home-preview-date", function () {
    var date = $("#ch-home-pack-preview-date").val();
    if (!date) {
      $("#ch-home-pack-preview-date").trigger("focus");
      return;
    }
    var url = new URL(window.location.href);
    url.searchParams.set("page", "ch-home-sections");
    url.searchParams.set("ch_tab", "packs");
    url.searchParams.set("ch_preview_date", date);
    url.searchParams.delete("settings-updated");
    window.location.assign(url.toString());
  });

  $(document).on("change", ".ch-home-hero-image .ch-home-override-mode select", function () {
    var $slot = $(this).closest(".ch-home-hero-image");
    syncHeroImageSlot($slot, $(this).val(), $slot.attr("data-mode"));
  });
  $(document).on("click", ".ch-home-restore-image", function () {
    $(this).closest(".ch-home-hero-image").find(".ch-home-override-mode select").val("default").trigger("change");
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
    if ($(this).closest(".ch-home-pack-preview").length) return;
    var $row = $(this).closest(".ch-home-row");
    if (!$row.length && activeRow) $row = activeRow;
    if ($row.length) clearValidationErrors($row);
    else clearFieldError($(this));
    $(".ch-home-savebar span").text("Unsaved changes");
    $(".ch-home-savebar").removeClass("is-error is-saving");
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

  $(document).on("click", ".ch-home-select-hero-image", function (event) {
    event.preventDefault();
    var $slot = $(this).closest(".ch-home-hero-image");
    var picker = wp.media({ title: "Choose a Hero image", button: { text: "Use this image" }, library: { type: "image" }, multiple: false });
    picker.on("select", function () {
      var attachment = picker.state().get("selection").first().toJSON();
      var source = attachment.sizes && attachment.sizes.medium ? attachment.sizes.medium.url : attachment.url;
      $slot.find(".ch-home-image-id").val(attachment.id);
      $slot.find(".ch-home-image-preview").attr("src", source).prop("hidden", false);
      $slot.find(".ch-home-image-empty").prop("hidden", true);
      $slot.find(".ch-home-image-state").text("Custom image override");
      $slot.find(".ch-home-remove-hero-image").prop("hidden", false);
      $slot.find(".ch-home-override-mode select").val("custom");
      $slot.attr("data-mode", "custom").find(".ch-home-restore-image").prop("hidden", false);
      $(".ch-home-savebar").addClass("is-dirty");
    });
    picker.open();
  });

  $(document).on("click", ".ch-home-remove-hero-image", function () {
    var $slot = $(this).closest(".ch-home-hero-image");
    $slot.find(".ch-home-image-id").val("");
    $slot.find(".ch-home-image-preview").attr("src", "").prop("hidden", true);
    $slot.find(".ch-home-image-empty").prop("hidden", false);
    $slot.find(".ch-home-image-state").text("Custom image cleared");
    $slot.find(".ch-home-remove-hero-image").prop("hidden", true);
    $slot.find(".ch-home-override-mode select").val("custom");
    $slot.attr("data-mode", "custom").find(".ch-home-restore-image").prop("hidden", false);
    $(".ch-home-savebar").addClass("is-dirty");
  });

  $(document).on("click", ".ch-home-hero-restore", function () {
    var $panel = $(this).closest(".ch-home-panel");
    $panel.find(".ch-home-override-mode select").each(function () { $(this).val("default").trigger("change"); });
    $panel.find(".ch-home-hero-field input, .ch-home-hero-field textarea").each(function () {
      if (this.dataset.chDefault !== undefined) this.value = this.dataset.chDefault;
    });
    $panel.find(".ch-home-hero-stat input[type=text]").each(function () {
      if (this.dataset.chDefault !== undefined) this.value = this.dataset.chDefault;
    });
    $panel.find(".ch-home-hero-stat input[type=checkbox]").prop("checked", true);
    $panel.find(".ch-home-hero-enable-value").val("1");
    $panel.find(".ch-home-savebar").addClass("is-dirty");
  });

  // PHP preserves submitted field order; renumber after moves and before saving.
  $(document).on("submit", "#ch-home-settings-form", function (event) {
    if (activeRow) closeDrawer(true);
    clearValidationErrors($(this));
    var $firstInvalid = validateSettingsForm($(this));
    if ($firstInvalid) {
      event.preventDefault();
      $(".ch-home-savebar").addClass("is-dirty");
      revealField($firstInvalid);
      return;
    }
    $(this).find(".ch-home-rows").each(function () {
      $(this).children(".ch-home-row").each(function (index) {
        $(this).find("[name]").each(function () {
          this.name = this.name.replace(/\[\d+\](?=\[)/, "[" + index + "]");
        });
      });
    });
    $(".ch-home-savebar span").text("Saving homepage changes…");
    $(".ch-home-savebar").addClass("is-saving").removeClass("is-error");
  });
})(jQuery);
