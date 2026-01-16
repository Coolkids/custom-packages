include $(TOPDIR)/rules.mk

PKG_NAME:=bandix
PKG_VERSION:=0.12.0
PKG_RELEASE:=1

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/timsaya/bandix/tar.gz/v$(PKG_VERSION)?
PKG_HASH:=B3975A90AFACCDAF789DFD30E05F932EDE17A8E4FB68A0BE599C59B0FB61F1B4

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=timsaya

PKG_BUILD_DEPENDS:=rust/host
PKG_BUILD_PARALLEL:=1

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/rust/rust-package.mk

define Package/bandix
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=Bandix
  DEPENDS:=$(RUST_ARCH_DEPENDS)
endef

define Package/bandix/description
 Bandix is a Rust-based application.
endef

define Build/Compile
	$(call Cargo/Compile,\
		--release \
	)
endef

define Package/bandix/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) \
		$(PKG_BUILD_DIR)/target/$(RUST_TARGET)/release/bandix \
		$(1)/usr/bin/bandix

	# 添加启动脚本和配置文件
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_BIN) ./files/bandix.init $(1)/etc/init.d/bandix

	# 将配置文件安装到临时位置，由 postinst 决定是否复制到最终位置
	$(INSTALL_DIR) $(1)/usr/share/bandix
	$(INSTALL_CONF) ./files/bandix.config $(1)/etc/config/bandix
endef

define Package/bandix/postinst
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	if ! grep -q "^/usr/share/bandix$$" /etc/sysupgrade.conf; then
		echo "/usr/share/bandix" >> /etc/sysupgrade.conf
	fi
	if ! grep -q "^/etc/config/bandix$$" /etc/sysupgrade.conf; then
		echo "/etc/config/bandix" >> /etc/sysupgrade.conf
	fi
fi
endef

$(eval $(call BuildPackage,bandix))