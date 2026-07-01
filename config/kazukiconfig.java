package net.kazuki.mod.config;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import net.fabricmc.loader.api.FabricLoader;
import java.io.File;
import java.io.FileReader;

public class KazukiConfig {
    public static String windowTitle = "Kazuki Client";
    public static boolean hudEnabled = true;

    public static void load() {
        try {
            File configFile = new File(FabricLoader.getInstance().getGameDir().toFile(), "config/kazuki-client.json");
            if (configFile.exists()) {
                FileReader reader = new FileReader(configFile);
                JsonObject json = new Gson().fromJson(reader, JsonObject.class);
                if (json.has("windowTitle")) windowTitle = json.get("windowTitle").getAsString();
                if (json.has("hudEnabled")) hudEnabled = json.get("hudEnabled").getAsBoolean();
                reader.close();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}