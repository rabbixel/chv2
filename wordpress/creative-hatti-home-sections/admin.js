(function ($) {
  "use strict";

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
  });

  $(document).on("click", ".ch-home-remove-row", function () {
    $(this).closest(".ch-home-row").remove();
  });

  $(document).on("click", ".ch-home-move-up", function () {
    var $row = $(this).closest(".ch-home-row");
    $row.prev(".ch-home-row").before($row);
  });

  $(document).on("click", ".ch-home-move-down", function () {
    var $row = $(this).closest(".ch-home-row");
    $row.next(".ch-home-row").after($row);
  });

  $(document).on("click", ".ch-home-select-image", function (event) {
    event.preventDefault();
    var $row = $(this).closest(".ch-home-row");
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
      $row.find(".ch-home-image-id").val(attachment.id);
      $row.find(".ch-home-image-preview").attr("src", source).prop("hidden", false);
      $row.find(".ch-home-remove-image").prop("hidden", false);
    });
    picker.open();
  });

  $(document).on("click", ".ch-home-remove-image", function () {
    var $row = $(this).closest(".ch-home-row");
    $row.find(".ch-home-image-id").val("");
    $row.find(".ch-home-image-preview").attr("src", "").prop("hidden", true);
    $(this).prop("hidden", true);
  });

  // PHP preserves submitted field order; renumber after moves and before saving.
  $(document).on("submit", ".ch-home-sections form", function () {
    $(this).find(".ch-home-rows").each(function () {
      $(this).children(".ch-home-row").each(function (index) {
        $(this).find("[name]").each(function () {
          this.name = this.name.replace(/\[\d+\](?=\[)/, "[" + index + "]");
        });
      });
    });
  });
})(jQuery);
