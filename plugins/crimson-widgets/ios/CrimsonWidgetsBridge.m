#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(CrimsonWidgets, NSObject)
RCT_EXTERN_METHOD(updateSnapshot:(NSString *)json resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
@end
