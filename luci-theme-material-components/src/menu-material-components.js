"use strict";
"require baseclass";
"require ui";

return baseclass.extend({
  __init__: function () {
    ui.menu.load().then(L.bind(this.render, this));
  },

  render: function (tree) {
    var l = (level || 0) + 1,
      ul = E("ul", { class: level ? "slide-menu" : "nav" }),
      children = ui.menu.getChildren(tree);

    if (children.length == 0 || l > 2) return E([]);

    for (var i = 0; i < children.length; i++) {
      var isActive = L.env.dispatchpath[l] == children[i].name,
        submenu = this.renderMainMenu(children[i], url + "/" + children[i].name, l),
        hasChildren = submenu.children.length;

      ul.appendChild(
        E(
          "li",
          {
            class: hasChildren ? "slide" + (isActive ? " active" : "") : isActive ? " active" : "",
          },
          [
            E(
              "a",
              {
                href: hasChildren ? "#" : L.url(url, children[i].name),
                class: hasChildren ? "menu" + (isActive ? " active" : "") : null,
                click: hasChildren ? ui.createHandlerFn(this, "handleMenuExpand") : null,
                "data-title": hasChildren ? null : _(children[i].title),
              },
              [_(children[i].title)]
            ),
            submenu,
          ]
        )
      );
    }

    if (l == 1) {
      var container = document.querySelector("#mainmenu");

      container.appendChild(ul);
      container.style.display = "";
    }

    return ul;
  },
});
