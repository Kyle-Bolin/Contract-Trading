import {
  PreSignUpTriggerEvent,
  PreSignUpTriggerHandler,
} from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminLinkProviderForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

export const handler: PreSignUpTriggerHandler = async (
  event: PreSignUpTriggerEvent,
) => {
  // Auto-confirm and auto-verify email for all sign-ups
  event.response.autoConfirmUser = true;
  event.response.autoVerifyEmail = true;

  // Handle account linking for federated sign-ups
  const { triggerSource, userPoolId, userName, request } = event;

  if (
    triggerSource === 'PreSignUp_ExternalProvider' &&
    request.userAttributes.email
  ) {
    const email = request.userAttributes.email;

    // Check if a user with this email already exists
    const listResponse = await cognito.send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Filter: `email = "${email}"`,
        Limit: 1,
      }),
    );

    const existingUser = listResponse.Users?.find(
      (u) => u.Username !== userName,
    );

    if (existingUser && existingUser.Username) {
      // Link the external provider to the existing user
      // userName for external providers is formatted as "Provider_userId"
      const [providerName, providerUserId] = userName.split('_');

      await cognito.send(
        new AdminLinkProviderForUserCommand({
          UserPoolId: userPoolId,
          DestinationUser: {
            ProviderName: 'Cognito',
            ProviderAttributeValue: existingUser.Username,
          },
          SourceUser: {
            ProviderName: providerName,
            ProviderAttributeName: 'Cognito_Subject',
            ProviderAttributeValue: providerUserId,
          },
        }),
      );
    }
  }

  return event;
};
