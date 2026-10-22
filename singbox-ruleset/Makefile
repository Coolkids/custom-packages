include $(TOPDIR)/rules.mk

PKG_NAME:=singbox-ruleset
PKG_VERSION:=2026.10.22~43ebb4f9
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/Coolkids/custom-ruleset.git
PKG_SOURCE_VERSION:=43ebb4f91f3a3a8a5f8e730791dc249c8e50f624
PKG_SOURCE_SUBDIR:=$(PKG_NAME)-$(PKG_VERSION)
PKG_SOURCE:=$(PKG_SOURCE_SUBDIR).tar.gz
PKG_MIRROR_HASH:=dae565e7510c18d6c7a3a71345fe68c92727d6a06284d03b25e0f8f37cb73db5

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
