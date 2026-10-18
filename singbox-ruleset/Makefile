include $(TOPDIR)/rules.mk

PKG_NAME:=singbox-ruleset
PKG_VERSION:=2026.10.18~8d914e3d
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/Coolkids/custom-ruleset.git
PKG_SOURCE_VERSION:=8d914e3d7d7f65ce5a79829f93642348cd6a7f92
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_MIRROR_HASH:=5a3b2b6555e7ab03ac919bb6682eb61ad245b9d3c97c0e8dbe74eaa0f8af4b88

PKG_MAINTAINER:=Coolkids
PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/singbox-ruleset
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Custom Sing-box RuleSet (geoip & geosite)
  DEPENDS:=
endef

define Package/singbox-ruleset/description
Prebuilt sing-box rule-sets generated from v2ray-rules-dat via geoview.
Installs geoip and geosite srs files into /usr/share/singbox.
endef

define Build/Compile
	
endef

define Package/singbox-ruleset/install
	$(INSTALL_DIR) $(1)/usr/share/singbox

	$(CP) $(PKG_BUILD_DIR)/output/geoip/*.srs $(1)/usr/share/singbox/
	$(CP) $(PKG_BUILD_DIR)/output/geosite/*.srs $(1)/usr/share/singbox/
endef

$(eval $(call BuildPackage,singbox-ruleset))
