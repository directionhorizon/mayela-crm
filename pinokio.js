module.exports = {
  version: "7.0",
  menu: async (kernel, info) => {
    return [{
      default: true,
      icon: "fa-solid fa-rocket",
      text: "Open App",
      href: "index.html"
    }]
  }
}
