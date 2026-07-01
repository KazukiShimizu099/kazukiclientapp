package net.kazuki.mod.mixin;

import net.kazuki.mod.config.KazukiConfig;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.util.Window;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(MinecraftClient.class)
public class MinecraftClientMixin {
    @Shadow private Window window;

    @Inject(method = "updateWindowTitle", at = @At("TAIL"))
    private void onUpdateWindowTitle(CallbackInfo ci) {
        // Overrides Minecraft title with launcher's custom configuration
        this.window.setTitle(KazukiConfig.windowTitle);
    }
}