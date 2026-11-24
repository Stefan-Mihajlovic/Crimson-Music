#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(CrimsonRemoteControls, RCTEventEmitter)

RCT_EXTERN_METHOD(configure:(BOOL)active
                  liked:(BOOL)liked
                  canGoNext:(BOOL)canGoNext
                  canGoPrevious:(BOOL)canGoPrevious
                  playing:(BOOL)playing
                  elapsedTime:(double)elapsedTime
                  duration:(double)duration)

RCT_EXTERN_METHOD(createCircularTabIcon:(NSString *)source
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(extractArtworkPalette:(NSString *)source
                  cacheKey:(NSString *)cacheKey
                  allowNetwork:(BOOL)allowNetwork
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(beginPlayerTransition:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(finishPlayerTransition:(NSString *)token
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancelPlayerTransition)
RCT_EXTERN_METHOD(completePlayerTransition)

RCT_EXTERN_METHOD(measurePlayerDestination:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(prepareOnboardingFeedback:(NSString *)uri)
RCT_EXTERN_METHOD(startOnboardingPull)
RCT_EXTERN_METHOD(updateOnboardingPull:(double)progress)
RCT_EXTERN_METHOD(stopOnboardingPull)
RCT_EXTERN_METHOD(completeOnboardingPull)
@end
