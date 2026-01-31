cask "avishek-web-push-tester" do
  version "1.0.0"
  sha256 :no_check

  # Update this URL when you have a GitHub release
  url "https://github.com/avishek-chatterjee/web-push-tester/releases/download/v#{version}/Avishek-Web-Push-Tester-#{version}-arm64.dmg"
  name "Avishek Web Push Tester"
  desc "A sleek Mac widget for testing web push notification tokens"
  homepage "https://github.com/avishek-chatterjee/web-push-tester"

  # For Intel Macs, use x64 version
  # url "https://github.com/avishek-chatterjee/web-push-tester/releases/download/v#{version}/Avishek-Web-Push-Tester-#{version}-x64.dmg"

  app "Avishek Web Push Tester.app"

  zap trash: [
    "~/Library/Application Support/avishek-web-push-tester",
    "~/Library/Preferences/com.avishek.webpushtester.plist",
    "~/Library/Saved Application State/com.avishek.webpushtester.savedState",
  ]
end
