Pod::Spec.new do |s|
 s.name='UltracamCamera'
 s.version='0.1.0'
 s.summary='Native camera streaming for Ultracam'
 s.description='Independent camera capture and local WebSocket streaming module.'
 s.license={ :type=>'Proprietary' }
 s.author='Ultracam'
 s.homepage='https://localhost/ultracam'
 s.platforms={ :ios=>'15.1' }
 s.source={ :path=>'.' }
 s.static_framework=true
 s.dependency 'ExpoModulesCore'
 s.frameworks='AVFoundation','CoreImage','UIKit'
 s.source_files='**/*.{h,m,mm,swift}'
 s.swift_version='5.9'
end
