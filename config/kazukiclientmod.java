package net.kazuki.mod;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.kazuki.mod.config.KazukiConfig;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;
import org.lwjgl.glfw.GLFW;

public class KazukiClientMod implements ClientModInitializer {
    private static KeyBinding hudKeybind;

    @Override
    public void onInitializeClient() {
        KazukiConfig.load();

        // Bind Key to RIGHT SHIFT (GLFW_KEY_RIGHT_SHIFT = 344)
        hudKeybind = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.kazuki.hud",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            "category.kazuki.client"
        ));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (hudKeybind.wasPressed()) {
                if (client.player != null) {
                    // Opens a dummy screen. Future inside this: Render your draggable HUD modules.
                    client.setScreen(new DummyHudScreen());
                }
            }
        });
    }
}

class DummyHudScreen extends Screen {
    protected DummyHudScreen() {
        super(Text.literal("Kazuki HUD Editor"));
    }
}